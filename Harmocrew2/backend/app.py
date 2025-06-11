import re
from flask import Flask, request, jsonify
from flask_cors import CORS
import jwt
import datetime
from functools import wraps
from werkzeug.security import generate_password_hash, check_password_hash
from db.init_db import init_db, get_connection
import mysql.connector
from mysql.connector import errorcode

init_db()

app = Flask(__name__)
CORS(app)

app.config['SECRET_KEY'] = '4f7d8a9b2c3e1f0a9d7b5e6c8f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a'

EMAIL_REGEX = re.compile(r"[^@]+@[^@]+\.[^@]+")

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({"message": "Token é obrigatório!"}), 401

        parts = auth_header.split()
        if len(parts) != 2 or parts[0].lower() != "bearer":
            return jsonify({"message": "Cabeçalho de autorização inválido!"}), 401

        token = parts[1]

        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user_email = data['email']
        except jwt.ExpiredSignatureError:
            return jsonify({"message": "Token expirado!"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"message": "Token inválido!"}), 401
        except Exception as e:
            return jsonify({"message": "Erro ao validar token.", "error": str(e)}), 401

        return f(current_user_email, *args, **kwargs)

    return decorated

@app.route("/")
def home():
    return "Backend está funcionando!"

@app.route("/register", methods=["POST"])
def register():
    data = request.json or {}
    nome = data.get("nome", "").strip()
    email = data.get("email", "").strip()
    senha = data.get("senha", "")

    if not nome or not email or not senha:
        return jsonify({"message": "Nome, email e senha são obrigatórios."}), 400

    if not EMAIL_REGEX.match(email):
        return jsonify({"message": "Formato de email inválido."}), 400

    hashed_password = generate_password_hash(senha, method='pbkdf2:sha256')

    conn = None
    cursor = None
    try:
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT 1 FROM users WHERE email = %s", (email,))
        if cursor.fetchone():
            return jsonify({"message": "Usuário já existe com este email."}), 409

        cursor.callproc('CreateNewUser', (nome, email, hashed_password))
        conn.commit()

        return jsonify({"message": "Usuário criado com sucesso!"}), 201

    except mysql.connector.Error as err:
        return jsonify({"message": "Erro no banco de dados.", "error": str(err)}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@app.route("/login", methods=["POST"])
def login():
    data = request.json or {}
    email = data.get("email", "").strip()
    senha = data.get("senha", "")

    if not email or not senha:
        return jsonify({"message": "Email e senha são obrigatórios."}), 400

    conn = None
    cursor = None
    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
        user = cursor.fetchone()

        if not user or not check_password_hash(user['senha'], senha):
            return jsonify({"message": "Email ou senha incorretos."}), 401

        cursor.execute("UPDATE users SET last_login = NOW() WHERE id = %s", (user['id'],))
        conn.commit()

        token = jwt.encode({
            'email': user['email'],
            'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24)
        }, app.config['SECRET_KEY'], algorithm="HS256")

        return jsonify({
            "token": token,
            "user": {
                "id": user['id'],
                "nome": user['nome'],
                "email": user['email']
            }
        })

    except mysql.connector.Error as err:
        return jsonify({"message": "Erro no banco de dados.", "error": str(err)}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@app.route("/profile", methods=["GET"])
@token_required
def profile(current_user_email):
    conn = None
    cursor = None
    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id, nome, email FROM users WHERE email = %s", (current_user_email,))
        user = cursor.fetchone()

        if not user:
            return jsonify({"message": "Usuário não encontrado."}), 404

        return jsonify({"user": user})

    except mysql.connector.Error as err:
        return jsonify({"message": "Erro no banco de dados.", "error": str(err)}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@app.route("/posts", methods=["GET"])
@token_required
def get_posts(current_user_email):
    conn = None
    cursor = None
    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("""
            SELECT post_id AS id, user_nome AS nome, texto, created_at, user_id
            FROM UserPostsView
            ORDER BY created_at DESC
            LIMIT 50
        """)
        posts = cursor.fetchall()

        for post in posts:
            post['data'] = post.pop('created_at').strftime("%Y-%m-%d %H:%M:%S")

        return jsonify({"posts": posts})

    except mysql.connector.Error as err:
        return jsonify({"message": "Erro no banco de dados.", "error": str(err)}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@app.route("/posts", methods=["POST"])
@token_required
def create_post(current_user_email):
    data = request.json or {}
    texto = data.get("texto", "").strip()

    if not texto:
        return jsonify({"message": "O texto do post não pode ser vazio."}), 400

    conn = None
    cursor = None
    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("SELECT id FROM users WHERE email = %s", (current_user_email,))
        user = cursor.fetchone()
        if not user:
            return jsonify({"message": "Usuário não encontrado."}), 404

        cursor.execute(
            "INSERT INTO posts (user_id, texto) VALUES (%s, %s)",
            (user['id'], texto)
        )
        conn.commit()

        post_id = cursor.lastrowid

        cursor.execute("""
            SELECT p.id, u.nome, p.texto, p.created_at
            FROM posts p
            JOIN users u ON p.user_id = u.id
            WHERE p.id = %s
        """, (post_id,))
        post = cursor.fetchone()
        post['data'] = post.pop('created_at').strftime("%Y-%m-%d %H:%M:%S")

        return jsonify({"message": "Post criado com sucesso!", "post": post}), 201

    except mysql.connector.Error as err:
        return jsonify({"message": "Erro no banco de dados.", "error": str(err)}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@app.route("/candidatar/<int:post_id>", methods=["POST"])
@token_required
def candidatar(current_user_email, post_id):
    conn = None
    cursor = None
    try:
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT id FROM users WHERE email = %s", (current_user_email,))
        user = cursor.fetchone()
        if not user:
            return jsonify({"message": "Usuário não encontrado."}), 404

        user_id = user[0]

        cursor.execute("SELECT 1 FROM candidaturas WHERE user_id = %s AND post_id = %s", (user_id, post_id))
        if cursor.fetchone():
            return jsonify({"message": "Você já se candidatou a este post."}), 400

        cursor.execute("INSERT INTO candidaturas (user_id, post_id) VALUES (%s, %s)", (user_id, post_id))
        conn.commit()

        return jsonify({"message": "Candidatura enviada com sucesso!"})

    except mysql.connector.Error as err:
        return jsonify({"message": "Erro no banco de dados.", "error": str(err)}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@app.route("/candidaturas", methods=["GET"])
@token_required
def listar_candidaturas(current_user_email):
    conn = None
    cursor = None
    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("SELECT id FROM users WHERE email = %s", (current_user_email,))
        autor = cursor.fetchone()
        if not autor:
            return jsonify({"message": "Usuário não encontrado."}), 404

        autor_id = autor['id']

        cursor.execute("""
            SELECT
                candidatura_id AS id,
                data_candidatura AS data,
                candidato_nome AS nome_artista,
                post_texto
            FROM CandidacyDetailsView
            WHERE owner_id = %s
            ORDER BY data_candidatura DESC
        """, (autor_id,))
        candidaturas = cursor.fetchall()

        return jsonify({"candidaturas": candidaturas})

    except mysql.connector.Error as err:
        return jsonify({"message": "Erro ao buscar candidaturas.", "error": str(err)}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@app.route("/candidaturas/<int:candidatura_id>/<string:acao>", methods=["POST"])
@token_required
def acao_candidatura(current_user_email, candidatura_id, acao):
    if acao not in ["aceitar", "rejeitar"]:
        return jsonify({"message": "Ação inválida."}), 400

    conn = None
    cursor = None
    try:
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT p.user_id
            FROM candidaturas c
            JOIN posts p ON c.post_id = p.id
            WHERE c.id = %s
        """, (candidatura_id,))
        post_owner = cursor.fetchone()

        if not post_owner:
            return jsonify({"message": "Candidatura ou post associado não encontrado."}), 404

        cursor.execute("SELECT id FROM users WHERE email = %s", (current_user_email,))
        current_user_id = cursor.fetchone()[0]

        if post_owner[0] != current_user_id:
            return jsonify({"message": "Você não tem permissão para alterar esta candidatura."}), 403

        novo_status = "aceito" if acao == "aceitar" else "rejeitado"
        cursor.callproc('UpdateCandidacyStatus', (candidatura_id, novo_status))
        conn.commit()

        return jsonify({"message": f"Candidatura {novo_status} com sucesso!"})
    except mysql.connector.Error as err:
        return jsonify({"message": "Erro ao atualizar candidatura.", "error": str(err)}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@app.route("/search_users", methods=["GET"])
@token_required
def search_users(current_user_email):
    termo = request.args.get("q", "").strip()

    if not termo:
        return jsonify({"users": []})

    conn = None
    cursor = None
    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("SELECT id, nome, email FROM users WHERE nome LIKE %s LIMIT 10", (f"%{termo}%",))
        usuarios = cursor.fetchall()

        return jsonify({"users": usuarios})
    except mysql.connector.Error as err:
        return jsonify({"message": "Erro no banco de dados.", "error": str(err)}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@app.route("/candidaturas_recebidas", methods=["GET"])
@token_required
def candidaturas_recebidas(current_user_email):
    conn = None
    cursor = None
    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("SELECT id FROM users WHERE email = %s", (current_user_email,))
        user = cursor.fetchone()
        if not user:
            return jsonify({"message": "Usuário não encontrado."}), 404

        user_id = user['id']

        cursor.callproc('GetPendingCandidaciesForPostOwner', (user_id,))
        for result in cursor.stored_results():
            candidaturas = result.fetchall()
            break

        return jsonify({"candidaturas": candidaturas})

    except mysql.connector.Error as err:
        return jsonify({"message": "Erro no banco de dados.", "error": str(err)}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@app.route("/user/<int:user_id>", methods=["GET"])
@token_required
def get_user_by_id(current_user_email, user_id):
    conn = None
    cursor = None
    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("SELECT id, nome, email FROM users WHERE id = %s", (user_id,))
        user = cursor.fetchone()

        if not user:
            return jsonify({"message": "Usuário não encontrado."}), 404

        cursor.execute("SELECT GetUserPostCount(%s) AS post_count", (user_id,))
        post_count = cursor.fetchone()['post_count']

        cursor.execute("SELECT id FROM users WHERE email = %s", (current_user_email,))
        current_user_db = cursor.fetchone()
        current_user_id = current_user_db['id'] if current_user_db else None

        is_following = False
        if current_user_id:
            cursor.execute("SELECT IsFollowing(%s, %s) AS is_following", (current_user_id, user_id))
            is_following = cursor.fetchone()['is_following']

        user['post_count'] = post_count
        user['is_following'] = bool(is_following)

        return jsonify({"user": user})

    except mysql.connector.Error as err:
        return jsonify({"message": "Erro no banco de dados.", "error": str(err)}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@app.route("/follow/<int:user_id>", methods=["POST"])
@token_required
def follow_user(current_user_email, user_id):
    conn = None
    cursor = None
    try:
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT id FROM users WHERE email = %s", (current_user_email,))
        row = cursor.fetchone()
        if not row:
            return jsonify({"message": "Usuário não encontrado."}), 404
        follower_id = row[0]

        if follower_id == user_id:
            return jsonify({"message": "Você não pode seguir a si mesmo."}), 400

        try:
            cursor.execute(
                "INSERT INTO seguidores (seguidor_id, seguido_id) VALUES (%s, %s)",
                (follower_id, user_id)
            )
            conn.commit()
        except mysql.connector.IntegrityError as e:
            if e.errno == errorcode.ER_DUP_ENTRY:
                return jsonify({"message": "Você já está seguindo este usuário."}), 400
            else:
                raise e

        return jsonify({"message": "Seguindo usuário com sucesso!"})

    except mysql.connector.Error as err:
        return jsonify({"message": "Erro ao seguir usuário.", "error": str(err)}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@app.route("/followers/<int:user_id>", methods=["GET"])
@token_required
def get_followers(current_user_email, user_id):
    conn = None
    cursor = None
    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("""
            SELECT u.id, u.nome, u.email
            FROM seguidores s
            JOIN users u ON s.seguidor_id = u.id
            WHERE s.seguido_id = %s
        """, (user_id,))
        followers = cursor.fetchall()

        return jsonify({"followers": followers})

    except mysql.connector.Error as err:
        return jsonify({"message": "Erro ao buscar seguidores.", "error": str(err)}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@app.route("/following/<int:user_id>", methods=["GET"])
@token_required
def get_following(current_user_email, user_id):
    conn = None
    cursor = None
    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("""
            SELECT u.id, u.nome, u.email
            FROM seguidores s
            JOIN users u ON s.seguido_id = u.id
            WHERE s.seguidor_id = %s
        """, (user_id,))
        following = cursor.fetchall()

        return jsonify({"following": following})

    except mysql.connector.Error as err:
        return jsonify({"message": "Erro ao buscar quem o usuário está seguindo.", "error": str(err)}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@app.route('/unfollow/<int:user_id>', methods=['POST'])
@token_required
def unfollow(current_user_email, user_id):
    conn = None
    cursor = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM users WHERE email = %s", (current_user_email,))
        current_user = cursor.fetchone()
        if not current_user:
            return jsonify({"message": "Usuário não encontrado."}), 404

        current_user_id = current_user[0]

        cursor.execute("""
            DELETE FROM seguidores WHERE seguidor_id = %s AND seguido_id = %s
        """, (current_user_id, user_id))
        conn.commit()

        if cursor.rowcount == 0:
            return jsonify({"message": "Você não está seguindo este usuário."}), 400

        return jsonify({"message": "Deixou de seguir o usuário com sucesso!"}), 200

    except mysql.connector.Error as err:
        return jsonify({"message": "Erro ao deixar de seguir o usuário.", "error": str(err)}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

if __name__ == "__main__":
    app.run(debug=True)

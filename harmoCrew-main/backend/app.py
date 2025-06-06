import re
import mysql.connector
from flask import Flask, request, jsonify
from flask_cors import CORS
import jwt
import datetime
from functools import wraps
from werkzeug.security import generate_password_hash, check_password_hash
from db.init_db import init_db
from db.database import get_connection

init_db()

app = Flask(__name__)

CORS(app, 
     resources={r"/*": {
         "origins": ["http://localhost:3000", "http://127.0.0.1:3000"]
     }},
     allow_headers=["Authorization", "Content-Type", "X-Requested-With"],
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
     supports_credentials=True,
     expose_headers=["Content-Type", "Authorization"]
)

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
    return "Backend HarmoCrew está funcionando!"

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
    default_profile_pic_url = f"https://i.pravatar.cc/150?u={email}" 

    conn = None
    cursor = None
    try:
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT 1 FROM users WHERE email = %s", (email,))
        if cursor.fetchone():
            return jsonify({"message": "Usuário já existe com este email."}), 409

        cursor.execute("INSERT INTO users (nome, email, senha, profile_pic_url) VALUES (%s, %s, %s, %s)",
                       (nome, email, hashed_password, default_profile_pic_url))
        conn.commit()
        return jsonify({"message": "Usuário criado com sucesso!"}), 201
    except mysql.connector.Error as err:
        return jsonify({"message": "Erro no banco de dados ao registrar.", "error": str(err)}), 500
    finally:
        if cursor: cursor.close()
        if conn and conn.is_connected(): conn.close()

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
        cursor.execute("SELECT id, nome, email, senha, profile_pic_url FROM users WHERE email = %s", (email,))
        user = cursor.fetchone()

        if not user or not check_password_hash(user['senha'], senha):
            return jsonify({"message": "Email ou senha incorretos."}), 401

        expiration_time = datetime.datetime.now(datetime.UTC) + datetime.timedelta(hours=24)
        token = jwt.encode({
            'email': user['email'],
            'id': user['id'], 
            'exp': expiration_time
        }, app.config['SECRET_KEY'], algorithm="HS256")
        
        profile_pic_url = user.get('profile_pic_url') or f"https://i.pravatar.cc/150?u={user['id']}"

        return jsonify({
            "token": token,
            "user": {
                "id": user['id'],
                "nome": user['nome'],
                "email": user['email'],
                "profile_pic_url": profile_pic_url
            }
        })
    except mysql.connector.Error as err:
        return jsonify({"message": "Erro no banco de dados ao logar.", "error": str(err)}), 500
    finally:
        if cursor: cursor.close()
        if conn and conn.is_connected(): conn.close()

@app.route("/profile", methods=["GET"])
@token_required
def profile(current_user_email):
    conn = None
    cursor = None
    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id, nome, email, profile_pic_url FROM users WHERE email = %s", (current_user_email,))
        user = cursor.fetchone()

        if not user:
            return jsonify({"message": "Usuário não encontrado."}), 404
        
        user['profile_pic_url'] = user.get('profile_pic_url') or f"https://i.pravatar.cc/150?u={user['id']}"

        return jsonify({"user": user})
    except mysql.connector.Error as err:
        return jsonify({"message": "Erro no banco de dados ao buscar perfil.", "error": str(err)}), 500
    finally:
        if cursor: cursor.close()
        if conn and conn.is_connected(): conn.close()

@app.route("/posts", methods=["GET"])
@token_required
def get_posts(current_user_email):
    conn = None
    cursor = None
    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT p.id, p.user_id, u.nome, u.profile_pic_url,
                   p.titulo, p.texto, p.audio_url, p.created_at
            FROM posts p
            JOIN users u ON p.user_id = u.id
            ORDER BY p.created_at DESC
            LIMIT 50
        """)
        posts = cursor.fetchall()
        
        for post_item in posts: 
            post_item['data'] = post_item.pop('created_at').strftime("%Y-%m-%d %H:%M:%S")
            post_item['profile_pic_url'] = post_item.get('profile_pic_url') or f"https://i.pravatar.cc/50?u={post_item['user_id']}"

        return jsonify({"posts": posts})
    except mysql.connector.Error as err:
        return jsonify({"message": "Erro no banco de dados ao buscar posts.", "error": str(err)}), 500
    finally:
        if cursor: cursor.close()
        if conn and conn.is_connected(): conn.close()

@app.route("/posts", methods=["POST"])
@token_required
def create_post(current_user_email):
    data = request.json or {}
    titulo = data.get("titulo", "").strip()
    texto = data.get("texto", "").strip()
    raw_audio_url = data.get("audio_url")
    audio_url = raw_audio_url.strip() if isinstance(raw_audio_url, str) else None

    if not titulo or not texto: 
        return jsonify({"message": "Título e texto do post não podem ser vazios."}), 400

    conn = None
    cursor = None
    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id, nome, profile_pic_url FROM users WHERE email = %s", (current_user_email,))
        user = cursor.fetchone()
        if not user:
            return jsonify({"message": "Usuário não encontrado."}), 404

        cursor.execute(
            "INSERT INTO posts (user_id, titulo, texto, audio_url) VALUES (%s, %s, %s, %s)",
            (user['id'], titulo, texto, audio_url)
        )
        conn.commit()
        post_id = cursor.lastrowid

        created_at_datetime = datetime.datetime.now(datetime.UTC)
        new_post_data = {
            "id": post_id,
            "user_id": user['id'],
            "nome": user['nome'],
            "profile_pic_url": user.get('profile_pic_url') or f"https://i.pravatar.cc/50?u={user['id']}",
            "titulo": titulo,
            "texto": texto,
            "audio_url": audio_url,
            "data": created_at_datetime.strftime("%Y-%m-%d %H:%M:%S") 
        }
        return jsonify({"message": "Post criado com sucesso!", "post": new_post_data}), 201
    except mysql.connector.Error as err:
        return jsonify({"message": "Erro no banco de dados ao criar post.", "error": str(err)}), 500
    finally:
        if cursor: cursor.close()
        if conn and conn.is_connected(): conn.close()

# Seguidores
@app.route("/api/me/following", methods=["GET"])
@token_required
def get_my_following(current_user_email):
    conn = None
    cursor = None
    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id FROM users WHERE email = %s", (current_user_email,))
        user = cursor.fetchone()
        if not user:
            return jsonify({"message": "Usuário logado não encontrado."}), 404
        current_user_id = user['id']

        cursor.execute("""
            SELECT u.id, u.nome, u.email, u.profile_pic_url 
            FROM seguidores s
            JOIN users u ON s.seguido_id = u.id
            WHERE s.seguidor_id = %s
        """, (current_user_id,))
        following_list = cursor.fetchall()

        for followed_user in following_list:
            followed_user['profile_pic_url'] = followed_user.get('profile_pic_url') or f'https://i.pravatar.cc/30?u={followed_user["id"]}'
        
        return jsonify({"following": following_list})
    except mysql.connector.Error as err:
        return jsonify({"message": "Erro no banco de dados.", "error": str(err)}), 500
    finally:
        if cursor: cursor.close()
        if conn and conn.is_connected(): conn.close()

# Candidaturas
@app.route("/candidatar/<int:post_id>", methods=["POST"])
@token_required
def candidatar(current_user_email, post_id):
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

        cursor.execute("SELECT user_id FROM posts WHERE id = %s", (post_id,))
        post_owner = cursor.fetchone()
        if not post_owner:
            return jsonify({"message": "Post não encontrado."}), 404
        
        if post_owner['user_id'] == user_id:
            return jsonify({"message": "Você não pode se candidatar ao seu próprio post."}), 400

        cursor.execute("SELECT 1 FROM candidaturas WHERE user_id = %s AND post_id = %s", (user_id, post_id))
        if cursor.fetchone():
            return jsonify({"message": "Você já se candidatou a este post."}), 400

        cursor.execute("INSERT INTO candidaturas (user_id, post_id) VALUES (%s, %s)", (user_id, post_id))
        conn.commit()
        return jsonify({"message": "Candidatura enviada com sucesso!"})
    except mysql.connector.Error as err:
        return jsonify({"message": "Erro no banco de dados.", "error": str(err)}), 500
    finally:
        if cursor: cursor.close()
        if conn and conn.is_connected(): conn.close()

# Candidaturas
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

        query = """
        SELECT 
            c.id AS candidatura_id, c.post_id, c.user_id AS candidato_id, c.status,
            u.nome AS nome_candidato, u.email AS email_candidato, u.profile_pic_url AS candidato_profile_pic_url,
            p.titulo AS titulo_post, 
            DATE_FORMAT(c.data, '%Y-%m-%d %H:%i:%S') AS data_candidatura
        FROM candidaturas c
        JOIN posts p ON c.post_id = p.id
        JOIN users u ON c.user_id = u.id
        WHERE p.user_id = %s
        ORDER BY c.data DESC
        """
        cursor.execute(query, (user_id,))
        candidaturas = cursor.fetchall()

        for cand in candidaturas:
            cand['candidato_profile_pic_url'] = cand.get('candidato_profile_pic_url') or f"https://i.pravatar.cc/30?u={cand['candidato_id']}"

        return jsonify({"candidaturas": candidaturas})
    except mysql.connector.Error as err:
        return jsonify({"message": "Erro no banco de dados.", "error": str(err)}), 500
    finally:
        if cursor: cursor.close()
        if conn and conn.is_connected(): conn.close()

# Candidaturas
@app.route("/candidaturas/<int:candidatura_id>/<string:acao>", methods=["POST"])
@token_required
def atualizar_candidatura_status(current_user_email, candidatura_id, acao): 
    if acao not in ("aceitar", "rejeitar"):
        return jsonify({"message": "Ação inválida. Use 'aceitar' ou 'rejeitar'."}), 400
    
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

        cursor.execute("""
            SELECT c.id, p.user_id AS dono_post_id
            FROM candidaturas c
            JOIN posts p ON c.post_id = p.id
            WHERE c.id = %s
        """, (candidatura_id,))
        candidatura = cursor.fetchone()

        if not candidatura:
            return jsonify({"message": "Candidatura não encontrada."}), 404

        if candidatura['dono_post_id'] != user_id:
            return jsonify({"message": "Você não tem permissão para alterar esta candidatura."}), 403

        novo_status = "aceito" if acao == "aceitar" else "rejeitado"
        cursor.execute("UPDATE candidaturas SET status = %s WHERE id = %s", (novo_status, candidatura_id))
        conn.commit()
        return jsonify({"message": f"Candidatura {novo_status} com sucesso."})
    except mysql.connector.Error as err:
        return jsonify({"message": "Erro no banco de dados.", "error": str(err)}), 500
    finally:
        if cursor: cursor.close()
        if conn and conn.is_connected(): conn.close()

# Busca
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
        cursor.execute("SELECT id, nome, email, profile_pic_url FROM users WHERE nome LIKE %s LIMIT 10", (f"%{termo}%",))
        usuarios = cursor.fetchall()

        for usuario in usuarios:
            usuario['profile_pic_url'] = usuario.get('profile_pic_url') or f'https://i.pravatar.cc/30?u={usuario["id"]}'

        return jsonify({"users": usuarios})
    except mysql.connector.Error as err:
        return jsonify({"message": "Erro no banco de dados.", "error": str(err)}), 500
    finally:
        if cursor: cursor.close()
        if conn and conn.is_connected(): conn.close()

# Seguidores
@app.route("/user/<int:view_user_id>", methods=["GET"]) 
@token_required
def get_user_by_id(current_user_email, view_user_id): 
    conn = None
    cursor = None
    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute("SELECT id, nome, email, profile_pic_url FROM users WHERE id = %s", (view_user_id,))
        user_profile = cursor.fetchone()

        if not user_profile:
            return jsonify({"message": "Usuário não encontrado."}), 404

        user_profile['profile_pic_url'] = user_profile.get('profile_pic_url') or f"https://i.pravatar.cc/150?u={user_profile['id']}"

        cursor.execute("SELECT id FROM users WHERE email = %s", (current_user_email,))
        logged_user = cursor.fetchone()
        if not logged_user: 
            return jsonify({"message": "Erro ao identificar usuário logado."}), 500
        logged_user_id = logged_user['id']
        
        is_following = False
        if logged_user_id != view_user_id:
            cursor.execute("SELECT 1 FROM seguidores WHERE seguidor_id = %s AND seguido_id = %s", (logged_user_id, view_user_id))
            is_following = True if cursor.fetchone() else False
        
        user_profile['is_following'] = is_following

        return jsonify({"user": user_profile})
    except mysql.connector.Error as err:
        return jsonify({"message": "Erro no banco de dados.", "error": str(err)}), 500
    finally:
        if cursor: cursor.close()
        if conn and conn.is_connected(): conn.close()

# Seguidores
@app.route("/follow/<int:user_to_follow_id>", methods=["POST"]) 
@token_required
def follow_user(current_user_email, user_to_follow_id): 
    conn = None
    cursor = None
    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True) 
        cursor.execute("SELECT id FROM users WHERE email = %s", (current_user_email,))
        follower = cursor.fetchone()
        if not follower:
            return jsonify({"message": "Usuário seguidor não encontrado."}), 404
        follower_id = follower['id']

        if follower_id == user_to_follow_id:
            return jsonify({"message": "Você não pode seguir a si mesmo."}), 400

        cursor.execute("SELECT 1 FROM users WHERE id = %s", (user_to_follow_id,))
        if not cursor.fetchone():
            return jsonify({"message": "Usuário a ser seguido não encontrado."}), 404
        
        try:
            cursor.execute("INSERT INTO seguidores (seguidor_id, seguido_id) VALUES (%s, %s)", (follower_id, user_to_follow_id))
            conn.commit()
        except mysql.connector.IntegrityError as e:
            if e.errno == 1062: 
                return jsonify({"message": "Você já está seguindo este usuário."}), 409
            else:
                raise e 
        
        return jsonify({"message": "Seguindo usuário com sucesso!"})
    except mysql.connector.Error as err:
        return jsonify({"message": "Erro no banco de dados.", "error": str(err)}), 500
    finally:
        if cursor: cursor.close()
        if conn and conn.is_connected(): conn.close()

# Seguidores
@app.route('/unfollow/<int:user_to_unfollow_id>', methods=['POST']) 
@token_required
def unfollow(current_user_email, user_to_unfollow_id): 
    conn = None
    cursor = None
    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id FROM users WHERE email = %s", (current_user_email,))
        current_user = cursor.fetchone()
        if not current_user:
            return jsonify({"message": "Usuário atual não encontrado."}), 404
        current_user_id = current_user['id']

        cursor.execute("DELETE FROM seguidores WHERE seguidor_id = %s AND seguido_id = %s", (current_user_id, user_to_unfollow_id))
        conn.commit()

        if cursor.rowcount == 0:
            return jsonify({"message": "Usuário não era seguido."}), 400

        return jsonify({"message": "Deixou de seguir o usuário com sucesso!"}), 200
    except mysql.connector.Error as err:
        return jsonify({"message": "Erro no banco de dados.", "error": str(err)}), 500
    finally:
        if cursor: cursor.close()
        if conn and conn.is_connected(): conn.close()

# Seguidores
@app.route("/followers/<int:user_id_profile>", methods=["GET"]) 
@token_required
def get_followers(current_user_email, user_id_profile): 
    conn = None
    cursor = None
    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT u.id, u.nome, u.email, u.profile_pic_url
            FROM seguidores s
            JOIN users u ON s.seguidor_id = u.id 
            WHERE s.seguido_id = %s
        """, (user_id_profile,))
        followers = cursor.fetchall()

        for follower_user in followers:
            follower_user['profile_pic_url'] = follower_user.get('profile_pic_url') or f'https://i.pravatar.cc/30?u={follower_user["id"]}'

        return jsonify({"followers": followers})
    except mysql.connector.Error as err:
        return jsonify({"message": "Erro ao buscar seguidores.", "error": str(err)}), 500
    finally:
        if cursor: cursor.close()
        if conn and conn.is_connected(): conn.close()

# Seguidores
@app.route("/following/<int:user_id_profile>", methods=["GET"])
@token_required
def get_user_following_list(current_user_email, user_id_profile):
    conn = None
    cursor = None
    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute("""
            SELECT u.id, u.nome, u.email, u.profile_pic_url
            FROM seguidores s
            JOIN users u ON s.seguido_id = u.id
            WHERE s.seguidor_id = %s 
        """, (user_id_profile,)) 
        following = cursor.fetchall()

        for followed_user in following:
            followed_user['profile_pic_url'] = followed_user.get('profile_pic_url') or f'https://i.pravatar.cc/30?u={followed_user["id"]}'
        
        return jsonify({"following": following})
    except mysql.connector.Error as err:
        return jsonify({"message": "Erro ao buscar quem o usuário segue.", "error": str(err)}), 500
    finally:
        if cursor: cursor.close()
        if conn and conn.is_connected(): conn.close()

if __name__ == "__main__":
    app.run(debug=True, host='0.0.0.0', port=5000)
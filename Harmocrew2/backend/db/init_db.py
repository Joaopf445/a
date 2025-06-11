import mysql.connector
from mysql.connector import errorcode

config = {
    'user': 'root',
    'password': '',
    'host': 'localhost'
}

DB_NAME = 'harmocrew'

TABLES = {}
TABLES['users'] = (
    "CREATE TABLE IF NOT EXISTS users ("
    "  id INT AUTO_INCREMENT PRIMARY KEY,"
    "  nome VARCHAR(255) NOT NULL,"
    "  email VARCHAR(255) NOT NULL UNIQUE,"
    "  senha VARCHAR(255) NOT NULL,"
    "  last_login TIMESTAMP"
    ") ENGINE=InnoDB"
)

TABLES['posts'] = (
    "CREATE TABLE IF NOT EXISTS posts ("
    "  id INT AUTO_INCREMENT PRIMARY KEY,"
    "  user_id INT NOT NULL,"
    "  texto TEXT NOT NULL,"
    "  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,"
    "  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,"
    "  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE"
    ") ENGINE=InnoDB"
)

TABLES['candidaturas'] = (
    "CREATE TABLE IF NOT EXISTS candidaturas ("
    "  id INT AUTO_INCREMENT PRIMARY KEY,"
    "  user_id INT NOT NULL,"
    "  post_id INT NOT NULL,"
    "  data TIMESTAMP DEFAULT CURRENT_TIMESTAMP,"
    "  status VARCHAR(20) DEFAULT 'pendente',"
    "  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,"
    "  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,"
    "  UNIQUE KEY unique_candidate (user_id, post_id)"
    ") ENGINE=InnoDB"
)

TABLES['seguidores'] = (
    "CREATE TABLE IF NOT EXISTS seguidores ("
    "  id INT AUTO_INCREMENT PRIMARY KEY,"
    "  seguidor_id INT NOT NULL,"
    "  seguido_id INT NOT NULL,"
    "  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,"
    "  UNIQUE(seguidor_id, seguido_id),"
    "  FOREIGN KEY (seguidor_id) REFERENCES users(id) ON DELETE CASCADE,"
    "  FOREIGN KEY (seguido_id) REFERENCES users(id) ON DELETE CASCADE"
    ") ENGINE=InnoDB;"
)

TABLES['audit_log'] = (
    "CREATE TABLE IF NOT EXISTS audit_log ("
    "  id INT AUTO_INCREMENT PRIMARY KEY,"
    "  table_name VARCHAR(255) NOT NULL,"
    "  action_type VARCHAR(50) NOT NULL,"
    "  record_id INT,"
    "  old_value TEXT,"
    "  new_value TEXT,"
    "  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
    ") ENGINE=InnoDB;"
)

def get_connection():
    try:
        return mysql.connector.connect(
            user=config['user'],
            password=config['password'],
            host=config['host'],
            database=DB_NAME
        )
    except mysql.connector.Error as err:
        raise

def init_db():
    conn = None
    cursor = None
    try:
        conn = mysql.connector.connect(**config)
        cursor = conn.cursor()

        try:
            cursor.execute(f"CREATE DATABASE IF NOT EXISTS {DB_NAME} DEFAULT CHARACTER SET 'utf8'")
        except mysql.connector.Error as err:
            return

        conn.database = DB_NAME

        for table_name in TABLES:
            table_description = TABLES[table_name]
            try:
                cursor.execute(table_description)
            except mysql.connector.Error as err:
                pass

        views = {
            'UserPostsView': """
                CREATE OR REPLACE VIEW UserPostsView AS
                SELECT
                    p.id AS post_id,
                    p.texto,
                    p.created_at,
                    p.updated_at,
                    u.id AS user_id,
                    u.nome AS user_nome,
                    u.email AS user_email
                FROM posts p
                JOIN users u ON p.user_id = u.id;
            """,
            'CandidacyDetailsView': """
                CREATE OR REPLACE VIEW CandidacyDetailsView AS
                SELECT
                    c.id AS candidatura_id,
                    c.data AS data_candidatura,
                    c.status AS status_candidatura,
                    u_cand.id AS candidato_id,
                    u_cand.nome AS candidato_nome,
                    u_cand.email AS candidato_email,
                    p.id AS post_id,
                    p.texto AS post_texto,
                    p.created_at AS post_created_at,
                    u_post.id AS owner_id,
                    u_post.nome AS owner_nome,
                    u_post.email AS owner_email
                FROM candidaturas c
                JOIN users u_cand ON c.user_id = u_cand.id
                JOIN posts p ON c.post_id = p.id
                JOIN users u_post ON p.user_id = u_post.id;
            """,
            'FollowerFollowingCountView': """
                CREATE OR REPLACE VIEW FollowerFollowingCountView AS
                SELECT
                    u.id AS user_id,
                    u.nome AS user_nome,
                    u.email AS user_email,
                    (SELECT COUNT(*) FROM seguidores WHERE seguido_id = u.id) AS followers_count,
                    (SELECT COUNT(*) FROM seguidores WHERE seguidor_id = u.id) AS following_count
                FROM users u;
            """,
            'ActiveUsersWithRecentPostsView': """
                CREATE OR REPLACE VIEW ActiveUsersWithRecentPostsView AS
                SELECT
                    u.id AS user_id,
                    u.nome AS user_nome,
                    u.email AS user_email,
                    MAX(p.created_at) AS last_post_date
                FROM users u
                JOIN posts p ON u.id = p.user_id
                WHERE p.created_at >= NOW() - INTERVAL 30 DAY
                GROUP BY u.id, u.nome, u.email
                HAVING COUNT(p.id) > 0;
            """
        }
        for view_name, view_sql in views.items():
            try:
                cursor.execute(view_sql)
            except mysql.connector.Error as err:
                pass

        triggers = {
            'after_user_insert': """
                CREATE TRIGGER after_user_insert
                AFTER INSERT ON users
                FOR EACH ROW
                INSERT INTO audit_log (table_name, action_type, record_id, new_value)
                VALUES ('users', 'INSERT', NEW.id, JSON_OBJECT('nome', NEW.nome, 'email', NEW.email));
            """,
            'before_post_update': """
                CREATE TRIGGER before_post_update
                BEFORE UPDATE ON posts
                FOR EACH ROW
                BEGIN
                    SET NEW.updated_at = NOW();
                    INSERT INTO audit_log (table_name, action_type, record_id, old_value, new_value)
                    VALUES ('posts', 'UPDATE', OLD.id,
                            JSON_OBJECT('texto', OLD.texto, 'updated_at', OLD.updated_at),
                            JSON_OBJECT('texto', NEW.texto, 'updated_at', NEW.updated_at));
                END;
            """,
            'after_post_delete': """
                CREATE TRIGGER after_post_delete
                AFTER DELETE ON posts
                FOR EACH ROW
                INSERT INTO audit_log (table_name, action_type, record_id, old_value)
                VALUES ('posts', 'DELETE', OLD.id, JSON_OBJECT('texto', OLD.texto, 'user_id', OLD.user_id));
            """,
            'after_candidatura_insert': """
                CREATE TRIGGER after_candidatura_insert
                AFTER INSERT ON candidaturas
                FOR EACH ROW
                INSERT INTO audit_log (table_name, action_type, record_id, new_value)
                VALUES ('candidaturas', 'INSERT', NEW.id, JSON_OBJECT('user_id', NEW.user_id, 'post_id', NEW.post_id, 'status', NEW.status));
            """,
            'before_candidatura_status_update': """
                CREATE TRIGGER before_candidatura_status_update
                BEFORE UPDATE ON candidaturas
                FOR EACH ROW
                BEGIN
                    IF OLD.status != NEW.status THEN
                        INSERT INTO audit_log (table_name, action_type, record_id, old_value, new_value)
                        VALUES ('candidaturas', 'STATUS_UPDATE', OLD.id,
                                JSON_OBJECT('status', OLD.status),
                                JSON_OBJECT('status', NEW.status));
                    END IF;
                END;
            """,
             'after_login_update_last_login': """
                CREATE TRIGGER after_login_update_last_login
                AFTER UPDATE ON users
                FOR EACH ROW
                BEGIN
                    IF OLD.last_login IS NULL OR OLD.last_login != NEW.last_login THEN
                        INSERT INTO audit_log (table_name, action_type, record_id, old_value, new_value)
                        VALUES ('users', 'LAST_LOGIN_UPDATE', OLD.id,
                                JSON_OBJECT('last_login', OLD.last_login),
                                JSON_OBJECT('last_login', NEW.last_login));
                    END IF;
                END;
            """
        }
        for trigger_name, trigger_sql in triggers.items():
            try:
                cursor.execute(f"DROP TRIGGER IF EXISTS {trigger_name};")
                cursor.execute(trigger_sql)
            except mysql.connector.Error as err:
                pass

        store_procedures = {
            'CreateNewUser': """
                DELIMITER //
                CREATE PROCEDURE CreateNewUser(
                    IN p_nome VARCHAR(255),
                    IN p_email VARCHAR(255),
                    IN p_senha_hash VARCHAR(255)
                )
                BEGIN
                    INSERT INTO users (nome, email, senha) VALUES (p_nome, p_email, p_senha_hash);
                END //
                DELIMITER ;
            """,
            'GetUserPosts': """
                DELIMITER //
                CREATE PROCEDURE GetUserPosts(IN p_user_id INT)
                BEGIN
                    SELECT id, texto, created_at, updated_at FROM posts WHERE user_id = p_user_id ORDER BY created_at DESC;
                END //
                DELIMITER ;
            """,
            'GetPendingCandidaciesForPostOwner': """
                DELIMITER //
                CREATE PROCEDURE GetPendingCandidaciesForPostOwner(IN p_owner_user_id INT)
                BEGIN
                    SELECT
                        c.id AS candidatura_id,
                        c.data AS data_candidatura,
                        u_cand.nome AS candidato_nome,
                        p.texto AS post_texto
                    FROM candidaturas c
                    JOIN users u_cand ON c.user_id = u_cand.id
                    JOIN posts p ON c.post_id = p.id
                    WHERE p.user_id = p_owner_user_id AND c.status = 'pendente'
                    ORDER BY c.data DESC;
                END //
                DELIMITER ;
            """,
            'UpdateCandidacyStatus': """
                DELIMITER //
                CREATE PROCEDURE UpdateCandidacyStatus(
                    IN p_candidatura_id INT,
                    IN p_new_status VARCHAR(20)
                )
                BEGIN
                    UPDATE candidaturas SET status = p_new_status WHERE id = p_candidatura_id;
                END //
                DELIMITER ;
            """
        }
        for sp_name, sp_sql in store_procedures.items():
            try:
                cursor.execute(f"DROP PROCEDURE IF EXISTS {sp_name};")
                cursor.execute(sp_sql)
            except mysql.connector.Error as err:
                pass

        functions = {
            'GetUserPostCount': """
                DELIMITER //
                CREATE FUNCTION GetUserPostCount(p_user_id INT) RETURNS INT
                DETERMINISTIC
                BEGIN
                    DECLARE post_count INT;
                    SELECT COUNT(*) INTO post_count FROM posts WHERE user_id = p_user_id;
                    RETURN post_count;
                END //
                DELIMITER ;
            """,
            'IsFollowing': """
                DELIMITER //
                CREATE FUNCTION IsFollowing(p_follower_id INT, p_followed_id INT) RETURNS BOOLEAN
                DETERMINISTIC
                BEGIN
                    DECLARE is_following BOOLEAN;
                    SELECT EXISTS(SELECT 1 FROM seguidores WHERE seguidor_id = p_follower_id AND seguido_id = p_followed_id) INTO is_following;
                    RETURN is_following;
                END //
                DELIMITER ;
            """
        }
        for func_name, func_sql in functions.items():
            try:
                cursor.execute(f"DROP FUNCTION IF EXISTS {func_name};")
                cursor.execute(func_sql)
            except mysql.connector.Error as err:
                pass

    except mysql.connector.Error as err:
        pass
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

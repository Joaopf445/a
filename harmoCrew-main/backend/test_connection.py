from db.database import get_connection

try:
    conn = get_connection()
    print("Conexão bem-sucedida!")
    conn.close()
except Exception as e:
    print("Erro ao conectar:", e)
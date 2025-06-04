import mysql.connector
from mysql.connector import Error

def get_connection():
    try:
        connection = mysql.connector.connect(
            host='localhost',
            user='harmo_user',
            password='SUA_SENHA_DO_APP',
            database='harmocrew'
        )
        if connection.is_connected():
            return connection
    except Error as e:
        print(f"Erro ao conectar no MySQL: {e}")
        return None

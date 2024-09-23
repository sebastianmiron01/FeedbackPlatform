import psycopg2
import secret

DATABASE = secret.DATABASE

def get_db_connection():
    conn = psycopg2.connect(
        dbname=DATABASE['dbname'],
        user=DATABASE['user'],
        password=DATABASE['password'],
        host=DATABASE['host'],
        port=DATABASE['port']
    )
    return conn

def update_tables():
    commands = [
        """
        ALTER TABLE form_response ADD COLUMN isValid BOOLEAN;

        """
    ]

    conn = None
    try:

        conn = get_db_connection()
        cur = conn.cursor()

        for command in commands:
            cur.execute(command)

        conn.commit()
        cur.close()
        print("Tables created successfully.")
    except (Exception, psycopg2.DatabaseError) as error:
        print(error)
    finally:
        if conn is not None:
            conn.close()

if __name__ == '__main__':
    update_tables()

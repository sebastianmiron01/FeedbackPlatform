from flask import Flask, request, jsonify
import secret
from db import get_db_connection
from psycopg2.extras import RealDictCursor
import jwt
import datetime
from openai import OpenAI
from functools import wraps
from flask_cors import CORS

app = Flask(__name__)
CORS(app)
secret_key = secret.secret_key
api_key = secret.api_key


POINTS_PER_FORM = 5



@app.route('/validateMessage', methods=['POST'])
def validate_message():
    data = request.get_json()
    message = data.get('message')

    client = OpenAI(
        api_key = secret.api_key
    )

    if not message:
        return jsonify({'valid': False, 'error': 'No message provided'}), 400

    try:
        response = client.completions.create(
            model="gpt-3.5-turbo-instruct",
            prompt=f"Please respond with 'yes' or 'no'.Could you tell me if this text could be a text received in a form for feedback on a course or a teacher: \"{message}\"",
            max_tokens=10
        )

        answer = response.choices[0].text.strip().lower()

        if 'yes' in answer:
            return jsonify({'valid': True}), 200
        else:
            return jsonify({'valid': False}), 200

    except Exception as e:
        return jsonify({'valid': False, 'error': str(e)}), 500


def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({'message': 'Token is missing!'}), 401

        try:
            token_type, token = auth_header.split()
            if token_type != 'Bearer':
                raise ValueError('Invalid token type')
            data = jwt.decode(token, secret_key, algorithms=["HS256"])
            user = data['user']
        except Exception as e:
            return jsonify({'message': 'Token is invalid!', 'error': str(e)}), 401

        return f(user, *args, **kwargs)

    return decorated

@app.route('/protected', methods=['GET'])
@token_required
def protected(user):
    return jsonify({'message': f'Hello, {user["email"]}!'})

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data['email']
    password = data['password']
    referred_by = data['referred_by']
    



    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    cur.execute("SELECT * FROM student WHERE email = %s", (email,))
    user = cur.fetchone()
    
    
    if user and user['pass'] == password:
        student_id = user['student_id']
        if referred_by:
            cur.execute("""UPDATE student SET referred_by = %s WHERE student_id = %s;""", (referred_by, student_id,))
        
        conn.commit()
        cur.close()
        conn.close()
        token = jwt.encode({
            'user': user,
            'exp': datetime.datetime.utcnow() + datetime.timedelta(minutes=30)
        }, secret_key, algorithm="HS256")
        return jsonify({'student_id': student_id, 'token': token}), 200
    else:
        cur.close()
        conn.close()
        return jsonify({'message': 'Invalid email or password'}), 401
    

@app.route('/getReferralLink', methods = ['GET'])
def get_referral_link():
    data = request.get_json()
    student_id = data['student_id']

    referral_link = f"http://localhost:5000/login?referred_by={student_id}"
    return jsonify({'message': 'The referral link requested:', 'referral_link': referral_link}), 200



@app.route('/completeForm', methods=['POST'])
def complete_form():
    data = request.get_json()
    
    teacher_id = data.get('teacher_id')
    course_id = data.get('course_id')
    student_id = data.get('student_id')
    points = data.get('points')
    response_text = data.get('response_text')
    future_response = data.get('future_response')
    lab_form = data.get('lab_form')
    isValid = data.get('isValid')

    if not all([teacher_id, course_id, student_id, points is not None, response_text, future_response, lab_form is not None, isValid is not None]):
        return jsonify({'message': 'Missing data in request'}), 400

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    try:
        cur.execute("SELECT * FROM enrollment WHERE student_id = %s AND course_id = %s;", (student_id, course_id))
        enrollment = cur.fetchone()
        if lab_form and enrollment['lab_form_completion'] == True:
            cur.close()
            conn.close()
            return jsonify({'message': 'User already completed this type of form.'}), 405
        if not lab_form and enrollment['course_form_completion'] == True:
            cur.close()
            conn.close()
            return jsonify({'message': 'User already completed this type of form.'}), 405
        if lab_form:
            cur.execute("""UPDATE enrollment SET lab_form_completion = TRUE WHERE student_id = %s and course_id = %s;""", (student_id, course_id,))
        else :
            cur.execute("""UPDATE enrollment SET course_form_completion = TRUE WHERE student_id = %s and course_id = %s;""", (student_id, course_id,))
        conn.commit() 
        cur.execute("""
            INSERT INTO form_response (teacher_id, course_id, student_id, points, response_text, future_response, islab, isvalid)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (teacher_id, course_id, student_id, points, response_text, future_response, lab_form, isValid))
        conn.commit()

        cur.execute("SELECT * FROM student WHERE student_id = %s", (student_id,))
        user = cur.fetchone()
        referred_by = user['referred_by']

        if isValid:
            cur.execute("""UPDATE student SET referral_points = %s WHERE student_id = %s;""", (user['referral_points'] + POINTS_PER_FORM, student_id,))
            conn.commit()
    
        

        if referred_by and isValid:
            cur.execute("SELECT * FROM student WHERE student_id = %s", (referred_by,))
            user = cur.fetchone()
            cur.execute("""UPDATE student SET referral_points = %s WHERE student_id = %s;""", (user['referral_points'] + POINTS_PER_FORM, referred_by,))
            conn.commit()

        cur.close()
        conn.close()
        return jsonify({'message': 'Form response submitted successfully!'}), 201
    except Exception as e:
        print(e)
        cur.close()
        conn.close()
        return jsonify({'message': 'Error submitting form response', 'error': str(e)}), 500

@app.route('/getTeachers', methods=['GET'])
def get_teachers():
    course_id = request.args.get('course_id')
    
    if not course_id:
        return jsonify({'message': 'course_id is required'}), 400

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        cur.execute(""" SELECT t.teacher_id, t.name FROM teacher t JOIN teaching_assignment ta ON t.teacher_id = ta.teacher_id WHERE ta.course_id = %s""", (course_id,))
        teachers = cur.fetchall()
        cur.close()
        conn.close()

        if not teachers:
            return jsonify({'message': 'No teachers found for the given course_id'}), 404

        return jsonify(teachers), 200
    except Exception as e:
        cur.close()
        conn.close()
        return jsonify({'message': 'Error retrieving teachers', 'error': str(e)}), 500


@app.route('/getstudent', methods=['POST'])
def get_student():
    data = request.get_json()
    student_id = data.get('student_id')

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("SELECT * FROM student WHERE student_id=%s", (student_id,))
    user = cur.fetchone()

    cur.close()
    conn.close()


    return jsonify(user)


@app.route('/getForms', methods=['POST'])
def get_forms():
    data = request.get_json()
    student_id = data['student_id']

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("""
        SELECT e.course_id, c.name AS course_name, e.lab_form_completion, e.course_form_completion
        FROM enrollment e
        JOIN course c ON e.course_id = c.course_id
        WHERE e.student_id = %s
        AND (e.lab_form_completion = false OR e.course_form_completion = false)
    """, (student_id,))
    courses = cur.fetchall()

    cur.close()
    conn.close()
    return jsonify({'message': 'Forms retrieved successfully!', 'courses': courses}), 200

@app.route('/getCompletedForms', methods=['POST'])
def get_completed_forms():
    data = request.get_json()
    student_id = data['student_id']

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("""
        SELECT 
            f.course_id,
            f.teacher_id,
            f.points,
            f.response_text,
            f.islab,
            f.isvalid,
            c.name as course_name,
            t.name as teacher_name
        FROM form_response f
        JOIN course c ON f.course_id = c.course_id
        JOIN teacher t ON f.teacher_id = t.teacher_id
        WHERE f.student_id = %s
    """, (student_id,))
    forms = cur.fetchall()

    cur.close()
    conn.close()
    return jsonify({'forms': forms}), 200



if __name__ == '__main__':
    app.run(debug=True)
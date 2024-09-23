import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './Home.css';

const Home = () => {
  const [courses, setCourses] = useState([]);
  const [studentName, setStudentName] = useState('');
  const [studentPoints, setStudentPoints] = useState(0);
  const [showTooltip, setShowTooltip] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [popupContent, setPopupContent] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [errorMessage, setErrorMessage] = useState('');
  const [validityMessage, setValidityMessage] = useState(null);
  const [submitAnyway, setSubmitAnyway] = useState(false);
  const [animationKey, setAnimationKey] = useState(0);

  const navigate = useNavigate();

  const fetchCourses = async () => {
    const studentId = localStorage.getItem('student_id');
    try {
      const response = await axios.post('http://localhost:5000/getForms', {
        student_id: studentId,
      });
      setCourses(response.data.courses);
    } catch (error) {
      console.error('Error fetching courses:', error);
    }
  };

  const fetchStudentInfo = async () => {
    const studentId = localStorage.getItem('student_id');
    try {
      const response = await axios.post('http://localhost:5000/getstudent', {
        student_id: studentId,
      });
      const studentData = response.data;
      setStudentName(`${studentData.first_name} ${studentData.last_name}`);
      setStudentPoints(studentData.referral_points);
    } catch (error) {
      console.error('Error fetching student information:', error);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    fetchCourses();
    fetchStudentInfo();
  }, [navigate]);

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  const handleViewProfile = () => {
    navigate('/myprofile');
  };

  const handleStartForm = async (course, formType) => {
    setPopupContent({
      ...course,
      type: formType,
    });
    setShowPopup(true);
    try {
      const response = await axios.get('http://localhost:5000/getTeachers', {
        params: { course_id: course.course_id },
      });
      setTeachers(response.data);
    } catch (error) {
      console.error('Error fetching teachers:', error);
    }
  };

  const closePopup = () => {
    setShowPopup(false);
    setPopupContent(null);
    setTeachers([]);
    setSelectedTeacher(null);
    setCurrentQuestion(0);
    setAnswers({});
    setErrorMessage('');
    setValidityMessage(null);
    setSubmitAnyway(false);
  };

  const calculateAnimationDuration = (index) => {
    const baseDuration = 0.5; 
    const totalItems = courses.length;
    const delayFactor = (totalItems - index) / totalItems;
    return `${baseDuration * delayFactor}s`;
  };

  const handleTeacherSelection = (event) => {
    setSelectedTeacher(event.target.value);
  };

  const handleAnswerChange = (questionIndex, value) => {
    setAnswers(prevAnswers => ({
      ...prevAnswers,
      [questionIndex]: value,
    }));
  };

  const handleNextQuestion = () => {
    if (currentQuestion < 4 && !answers[currentQuestion]) {
      setErrorMessage('Please select an option before proceeding.');
      return;
    }

    if (currentQuestion === 4 && (!answers[currentQuestion] || (typeof answers[currentQuestion] === 'string' && answers[currentQuestion].trim() === ''))) {
      setErrorMessage('Please provide a motive before submitting.');
      return;
    }

    setErrorMessage('');
    setCurrentQuestion(prevQuestion => prevQuestion + 1);

    if (currentQuestion < 4) {
      setAnswers(prevAnswers => ({
        ...prevAnswers,
        [currentQuestion + 1]: undefined,
      }));
    }
  };

  const handleStartFormClick = () => {
    if (!selectedTeacher) {
      setErrorMessage('Please select a teacher before starting the form.');
      return;
    }
    setErrorMessage('');
    setCurrentQuestion(1);
  };

  const checkValidity = async () => {
    const responseText = answers[4] || '';
    try {
      const response = await axios.post('http://localhost:5000/validateMessage', {
        message: responseText,
      });
      const { valid } = response.data;
      setValidityMessage(valid ? 'valid' : 'invalid');
      setAnswers(prevAnswers => ({
        ...prevAnswers,
        isValid: valid,
      }));
      return valid;
    } catch (error) {
      console.error('Error validating message:', error);
      setValidityMessage('invalid');
      setAnswers(prevAnswers => ({
        ...prevAnswers,
        isValid: false,
      }));
      return false;
    }
  };

  const handleSubmitForm = async () => {
    if (currentQuestion === 5 && !submitAnyway) {
      const isValid = await checkValidity();
      if (!isValid) {
        setValidityMessage('invalid');
        setErrorMessage('Please correct the message or submit anyway.');
        setSubmitAnyway(true);
        return;
      }
    }

    const points = Object.values(answers).reduce((sum, value) => {
      return typeof value === 'number' ? sum + value : sum;
    }, 0);

    const studentId = localStorage.getItem('student_id');

    try {
      await axios.post('http://localhost:5000/completeForm', {
        teacher_id: selectedTeacher,
        course_id: popupContent.course_id,
        student_id: studentId,
        points: points,
        response_text: answers[5] || '',
        future_response: answers[6] || '',
        lab_form: popupContent.type === 'lab',
        isValid: answers.isValid,
      });
      closePopup();

      await fetchCourses();
      await fetchStudentInfo();

      setAnimationKey(prevKey => prevKey + 1);
    } catch (error) {
      console.error('Error completing form:', error);
    }
  };

  const renderQuestion = () => {
    const questions = [
      { text: 'How would you rate the overall coverage of the subject?', type: 'rating' },
      { text: 'How would you rate the workload needed for this subject?', type: 'rating' },
      { text: 'How would you rate the collaboration with the teacher in this subject?', type: 'rating' },
      { text: 'How would you rate the assessments provided in this subject?', type: 'rating' },
      { text: 'Please provide a motive for the ratings offered before.', type: 'text' },
      { text: 'What do you suggest for improving future students’ experiences in this course?', type: 'text' },
    ];

    const question = questions[currentQuestion - 1];

    if (question.type === 'rating') {
      return (
        <div>
          <h3>{question.text}</h3>
          <div className="rating-options">
            {[1, 2, 3, 4, 5].map(value => (
              <label key={value}>
                <input 
                  type="radio" 
                  name={`question-${currentQuestion}`} 
                  value={value} 
                  checked={answers[currentQuestion] === value}
                  onChange={() => handleAnswerChange(currentQuestion, value)} 
                />
                {value}
              </label>
            ))}
          </div>
        </div>
      );
    } else if (question.type === 'text') {
      return (
        <div>
          <h3>{question.text}</h3>
          <div className="text-area-container">
            <textarea 
              value={answers[currentQuestion] || ''} 
              onChange={e => handleAnswerChange(currentQuestion, e.target.value)} 
            />
            {currentQuestion === 5 && (
              <button className="check-validity-button" onClick={checkValidity}>Check Validity</button>
            )}
          </div>
          {currentQuestion === 5 && validityMessage && (
            <p className={`validity-message ${validityMessage === 'valid' ? 'valid' : 'invalid'}`}>
              {validityMessage === 'valid' ? '✔️ Valid message' : '❗ Invalid message'}
            </p>
          )}
        </div>
      );
    }
  };

  return (
    <div className="home-container">
      {showPopup && (
        <div className="popup-overlay">
          <div className="popup">
            <button className="close-button" onClick={closePopup}>X</button>
            {currentQuestion === 0 ? (
              <div>
                <h2>{popupContent.course_name} - Survey</h2>
                <p>Survey for {popupContent.course_name}</p>
                <div className="teacher-selection">
                  <h3>Select a Teacher:</h3>
                  {teachers.length > 0 ? (
                    teachers.map((teacher) => (
                      <div key={teacher.teacher_id} className="teacher-option">
                        <input 
                          type="radio" 
                          id={`teacher-${teacher.teacher_id}`} 
                          name="teacher" 
                          value={teacher.teacher_id} 
                          onChange={handleTeacherSelection} 
                        />
                        <label htmlFor={`teacher-${teacher.teacher_id}`}>{teacher.name}</label>
                      </div>
                    ))
                  ) : (
                    <p>No teachers available for this course.</p>
                  )}
                </div>
                {errorMessage && <p className="error-message">{errorMessage}</p>}
                <button className="start-form-button" onClick={handleStartFormClick}>Start survey</button>
              </div>
            ) : (
              <div className="question-container">
                {renderQuestion()}
                {errorMessage && <p className="error-message">{errorMessage}</p>}
                {currentQuestion < 6 ? (
                  <button className="next-question-button" onClick={handleNextQuestion}>Next question</button>
                ) : (
                  <button className="submit-form-button" onClick={handleSubmitForm}>
                    {submitAnyway ? 'Submit Anyway' : 'Submit Survey'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      <div className={`main-content ${showPopup ? 'blurred' : ''}`}>
        <div className="topbar">
          <div className="app-name">Feedback Platform</div>
          <div className="student-info">
            <div 
              className={`student-points ${studentPoints > 0 ? 'points-positive' : 'points-zero'}`} 
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
            >
              {studentPoints} points
              {showTooltip && (
                <div className="tooltip">
                  Want to earn more points? Each valid survey completion will grant you 5 points. Additionally, you can refer a colleague to join the platform and get 5 points for their valid survey completions too. Visit the profile page to know more.
                </div>
              )}
            </div>
            <div className="dropdown">
              <span className="student-name">{studentName}</span>
              <span className="arrow">▼</span>
              <div className="dropdown-content">
                <div className="dropdown-item" onClick={handleViewProfile}>View Profile</div>
                <div className="dropdown-item" onClick={handleLogout}>Logout</div>
              </div>
            </div>
          </div>
        </div>
        <div className="sections">
          <div key={`lecture-${animationKey}`} className="lecture-section">
            <h2>Lecture part</h2>
            {courses.filter(course => !course.course_form_completion).map((course, index) => (
              <div 
                key={`${course.course_id || index}-lecture`} 
                className="course" 
                style={{ '--animation-duration': calculateAnimationDuration(index) }}
              >
                <h3>{course.course_name} - Lecture</h3>
                <p>{course.lectureDetails}</p>
                <button className="start-form-button" onClick={() => handleStartForm(course, 'lecture')}>Start survey</button>
              </div>
            ))}
          </div>
          <div key={`lab-${animationKey}`} className="lab-section">
            <h2>Aplicative part</h2>
            {courses.filter(course => !course.lab_form_completion).map((course, index) => (
              <div 
                key={`${course.course_id || index}-lab`} 
                className="course" 
                style={{ '--animation-duration': calculateAnimationDuration(index) }}
              >
                <h3>{course.course_name} - Lab</h3>
                <p>{course.labDetails}</p>
                <button className="start-form-button" onClick={() => handleStartForm(course, 'lab')}>Start survey</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;

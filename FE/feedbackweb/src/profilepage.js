import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './Profile.css';

const Profile = () => {
  const [studentInfo, setStudentInfo] = useState({});
  const [completedCourseForms, setCompletedCourseForms] = useState([]);
  const [completedLabForms, setCompletedLabForms] = useState([]);
  const [showTooltip, setShowTooltip] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProfileData = async () => {
      const studentId = localStorage.getItem('student_id');
      try {
        const studentResponse = await axios.post('http://localhost:5000/getstudent', {
          student_id: studentId,
        });
        setStudentInfo(studentResponse.data);

        const formsResponse = await axios.post('http://localhost:5000/getCompletedForms', {
          student_id: studentId,
        });

        const courseForms = formsResponse.data.forms.filter(form => !form.islab);
        const labForms = formsResponse.data.forms.filter(form => form.islab);

        setCompletedCourseForms(courseForms);
        setCompletedLabForms(labForms);
      } catch (error) {
        console.error('Error fetching profile data:', error);
      }
    };

    fetchProfileData();
  }, []);

  const referralLink = `http://localhost:3000/login?student_id=${studentInfo.student_id}`;

  const handleCopyReferralLink = () => {
    navigator.clipboard.writeText(referralLink).then(() => {
      alert('Referral link copied to clipboard!');
    });
  };

  return (
    <div className="profile-container">
      <div className="topbar">
        <div className="app-name">Feedback Platform</div>
        <div className="student-info">
          <div 
            className={`student-points ${studentInfo.referral_points > 0 ? 'points-positive' : 'points-zero'}`} 
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
          >
            {studentInfo.referral_points} points
            {showTooltip && (
              <div className="tooltip">
                Want to earn more points? Each valid form completion will grant you 5 points. Additionally, you can refer a colleague to join the platform and get 5 points for their valid form completions too.
              </div>
            )}
          </div>
          <div className="dropdown">
            <span className="student-name">{studentInfo.first_name} {studentInfo.last_name}</span>
            <span className="arrow">▼</span>
            <div className="dropdown-content">
              <div className="dropdown-item" onClick={() => navigate('/myprofile')}>View Profile</div>
              <div className="dropdown-item" onClick={() => {
                localStorage.clear();
                navigate('/login');
              }}>Logout</div>
            </div>
          </div>
        </div>
      </div>
      <button className="back-button" onClick={() => navigate('/home')}>Back to Home</button>
      <div className="profile-info">
        <h1>My Profile</h1>
        <p><strong>Name:</strong> {studentInfo.first_name} {studentInfo.last_name}</p>
        <p><strong>Points:</strong> {studentInfo.referral_points}</p>
      </div>
      <div className="referral-link">
        <h2>Referral Link</h2>
        <div className="referral-box">
          <input type="text" value={referralLink} readOnly />
          <button onClick={handleCopyReferralLink}>Copy</button>
        </div>
      </div>
      <div className="completed-forms">
        <h2>Completed Surveys</h2>
        <div className="forms-section">
          <div className="course-forms">
            <h3>Course Surveys</h3>
            <ul>
              {completedCourseForms.map((form, index) => (
                <li key={index}>
                  <p><strong>Course:</strong> {form.course_name || 'No course name available'}</p>
                  <p><strong>Teacher:</strong> {form.teacher_name}</p>
                  <p><strong>Points:</strong> {form.points}</p>
                  <p><strong>Valid:</strong> {form.isvalid ? 'Yes' : 'No'}</p>
                </li>
              ))}
            </ul>
          </div>
          <div className="lab-forms">
            <h3>Lab Surveys</h3>
            <ul>
              {completedLabForms.map((form, index) => (
                <li key={index}>
                  <p><strong>Course:</strong> {form.course_name || 'No course name available'}</p>
                  <p><strong>Teacher:</strong> {form.teacher_name}</p>
                  <p><strong>Points:</strong> {form.points}</p>
                  <p><strong>Valid:</strong> {form.isvalid ? 'Yes' : 'No'}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;

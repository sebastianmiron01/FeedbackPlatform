import React, { useState, useEffect } from 'react';
import './Login.css';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [referredBy, setReferredBy] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const referredByParam = params.get('referred_by');
    setReferredBy(referredByParam);
  }, [location]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      const response = await axios.post('http://localhost:5000/login', {
        email: email,
        password: password,
        referred_by: referredBy, 
      });

      const data = response.data;

      localStorage.setItem('token', data.token);
      localStorage.setItem('student_id', data.student_id);

      navigate('/home');

      console.log('Login successful:', data);
    } catch (error) {
      if (error.response && error.response.status === 401) {

        setErrorMessage('Invalid email or password.');
      } else {

        setErrorMessage('An error occurred. Please try again.');
        console.error('Login failed:', error.message);
      }
    }
  };

  return (
    <div className="login-container">
      <form className="login-form" onSubmit={handleSubmit}>
        <h2>Login</h2>
        {errorMessage && <p className="error-message">{errorMessage}</p>}
        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit">Login</button>
      </form>
    </div>
  );
};

export default Login;

import { useState, useEffect } from 'react';
import axios from 'axios';
import keycloak from './keycloak';
import './App.css';

function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [courses, setCourses] = useState([]);
  const [message, setMessage] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    keycloak.init({ onLoad: 'login-required', checkLoginIframe: false }).then(auth => {
      setAuthenticated(auth);
      if (auth) {
        getCourses();
      }
      setInitialized(true);
    }).catch(err => {
      console.error("Authenticated Failed", err);
      setInitialized(true);
    });
  }, []);

  const getAuthHeader = () => ({
    headers: { 'Authorization': `Bearer ${keycloak.token}` }
  });

  const handleError = (error) => {
    if (error.response) {
      if (error.response.status === 401) {
        setMessage("Session expired. Attempting refresh...");
        keycloak.updateToken(70).then(refreshed => {
          if (refreshed) {
            setMessage("Token refreshed. Please retry.");
          } else {
            keycloak.login();
          }
        });
      } else if (error.response.status === 403) {
        setMessage("Accès interdit (403)");
      } else {
        setMessage(`Error: ${error.response.status}`);
      }
    } else {
      setMessage("Network Error / Backend unreachable");
    }
  };

  const getCourses = () => {
    axios.get('http://localhost:8081/courses', getAuthHeader())
      .then(response => {
        setCourses(response.data);
      })
      .catch(handleError);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingId) {
      updateCourse();
    } else {
      createCourse();
    }
  };

  const createCourse = () => {
    axios.post('http://localhost:8081/courses', { title, description }, getAuthHeader())
      .then(response => {
        setCourses([...courses, response.data]);
        setMessage("Course created successfully!");
        resetForm();
      })
      .catch(handleError);
  };

  const updateCourse = () => {
    axios.put(`http://localhost:8081/courses/${editingId}`, { title, description }, getAuthHeader())
      .then(response => {
        setCourses(courses.map(c => c.id === editingId ? response.data : c));
        setMessage("Course updated successfully!");
        resetForm();
      })
      .catch(handleError);
  };

  const deleteCourse = (id) => {
    if (window.confirm("Are you sure you want to delete this course?")) {
      axios.delete(`http://localhost:8081/courses/${id}`, getAuthHeader())
        .then(() => {
          setCourses(courses.filter(c => c.id !== id));
          setMessage("Course deleted successfully.");
        })
        .catch(handleError);
    }
  };

  const startEdit = (course) => {
    setEditingId(course.id);
    setTitle(course.title);
    setDescription(course.description);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setDescription("");
  };

  if (!initialized) return <div className="loading">Loading Keycloak...</div>;

  if (!authenticated) {
    return (
      <div className="login-container">
        <p>Authentication Required</p>
        <button className="primary-btn" onClick={() => keycloak.login()}>Login</button>
      </div>
    );
  }

  const isAdmin = keycloak.hasRealmRole('ROLE_ADMIN');
  const user = keycloak.tokenParsed;

  return (
    <div className="app-container">
      <header className="header">
        <h1>E-Learning Platform</h1>
        <div className="user-info">
          <span>{user.preferred_username || user.name}</span>
          <button className="logout-btn" onClick={() => keycloak.logout()}>Logout</button>
        </div>
      </header>

      <main className="main-content">

        {isAdmin && (
          <section className="admin-section">
            <h2>{editingId ? "Modifier le cours" : "Ajouter un cours"}</h2>
            <form onSubmit={handleSubmit} className="course-form">
              <div className="form-group">
                <input
                  type="text"
                  placeholder="Course Title"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <textarea
                  placeholder="Description"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  required
                  rows="3"
                />
              </div>
              <div className="form-actions">
                <button type="submit" className="action-btn">
                  {editingId ? "Update Course" : "Create Course"}
                </button>
                {editingId && (
                  <button type="button" onClick={resetForm} className="cancel-btn">
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </section>
        )}

        <section className="courses-section">
          <div className="courses-header">
            <h2>Cours disponibles</h2>
            <button className="refresh-btn" onClick={getCourses}>Refraichir</button>
          </div>

          {message && <div className="status-message">{message}</div>}

          <div className="courses-list">
            {courses.length > 0 ? (
              courses.map(course => (
                <div key={course.id} className="course-card">
                  <div className="card-content">
                    <h3>{course.title}</h3>
                    <p>{course.description}</p>
                  </div>
                  {isAdmin && (
                    <div className="card-actions">
                      <button className="edit-btn" onClick={() => startEdit(course)}>Edit</button>
                      <button className="delete-btn" onClick={() => deleteCourse(course.id)}>Delete</button>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p className="no-data">Aucun cours disponible.</p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;

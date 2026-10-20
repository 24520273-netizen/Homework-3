import { useEffect, useState } from "react";
import "./App.css";

const API = "http://localhost:3000/api";

function App() {
  const [assignments, setAssignments] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    deadline: "",
    priority: "Medium",
    status: "Pending",
    subject_id: ""
  });

  const [selectedAssignment, setSelectedAssignment] = useState(null);
const [notes, setNotes] = useState([]);
const [noteContent, setNoteContent] = useState("");

  const loadAssignments = async () => {
    const response = await fetch(`${API}/assignments`);
    const data = await response.json();
    setAssignments(data);
    setLoading(false);
  };
  const loadActivities = async () => {
  const response = await fetch(`${API}/activities`);
  const data = await response.json();
  setActivities(data);
};

  const loadSubjects = async () => {
    const response = await fetch(`${API}/subjects`);
    const data = await response.json();
    setSubjects(data);
  };

  useEffect(() => {
    loadAssignments();
    loadSubjects();
     loadActivities();
  }, []);

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value
    });
  };

  const openAddForm = () => {
    setEditingId(null);

    setForm({
      title: "",
      description: "",
      deadline: "",
      priority: "Medium",
      status: "Pending",
      subject_id: subjects[0]?.id || ""
    });

    setShowForm(true);
  };

  const openEditForm = (assignment) => {
    setEditingId(assignment.id);

    setForm({
      title: assignment.title,
      description: assignment.description || "",
      deadline: assignment.deadline
        ? assignment.deadline.substring(0, 10)
        : "",
      priority: assignment.priority,
      status: assignment.status,
      subject_id: assignment.subject_id
    });

    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const method = editingId ? "PUT" : "POST";

    const url = editingId
      ? `${API}/assignments/${editingId}`
      : `${API}/assignments`;

    const response = await fetch(url, {
      method: method,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ...form,
        subject_id: Number(form.subject_id)
      })
    });

    if (!response.ok) {
      alert("Something went wrong.");
      return;
    }

    setShowForm(false);
    setEditingId(null);

    await loadAssignments();
    await loadActivities();
  };

  const handleDelete = async (id) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this assignment?"
    );

    if (!confirmed) {
      return;
    }

    const response = await fetch(`${API}/assignments/${id}`, {
      method: "DELETE"
    });

    if (!response.ok) {
      alert("Cannot delete assignment.");
      return;
    }

    await loadAssignments();
    await loadActivities();
  };

  const total = assignments.length;

  const completed = assignments.filter(
    (assignment) => assignment.status === "Completed"
  ).length;

  const pending = assignments.filter(
    (assignment) => assignment.status === "Pending"
  ).length;

  const overdue = assignments.filter((assignment) => {
    return (
      assignment.status !== "Completed" &&
      new Date(assignment.deadline) < new Date()
    );
  }).length;

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString("vi-VN");
  };

  const openNotes = async (assignment) => {
  setSelectedAssignment(assignment);

  const response = await fetch(
    `${API}/assignments/${assignment.id}/notes`
  );

  const data = await response.json();
  setNotes(data);
};

const addNote = async () => {
  if (!noteContent.trim()) return;

  const response = await fetch(
    `${API}/assignments/${selectedAssignment.id}/notes`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        content: noteContent
      })
    }
  );

  if (!response.ok) {
    alert("Cannot add note.");
    return;
  }

  setNoteContent("");
  openNotes(selectedAssignment);
};

const deleteNote = async (noteId) => {
  await fetch(
    `${API}/assignments/${selectedAssignment.id}/notes/${noteId}`,
    {
      method: "DELETE"
    }
  );

  openNotes(selectedAssignment);
};

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>Study Planner</h1>
          <p>Manage your subjects and assignments</p>
        </div>
      </header>

      <main className="container">
        <section className="dashboard">
          <div className="stat-card">
            <span>Total Assignments</span>
            <strong>{total}</strong>
          </div>

          <div className="stat-card">
            <span>Pending</span>
            <strong>{pending}</strong>
          </div>

          <div className="stat-card">
            <span>Completed</span>
            <strong>{completed}</strong>
          </div>

          <div className="stat-card">
            <span>Overdue</span>
            <strong>{overdue}</strong>
          </div>
        </section>

        <section className="assignments-section">
          <div className="section-header">
            <div>
              <h2>Assignments</h2>
              <p>Your current coursework</p>
            </div>

            <button
              className="add-button"
              onClick={openAddForm}
            >
              + Add Assignment
            </button>
          </div>

          {showForm && (
            <form
              className="assignment-form"
              onSubmit={handleSubmit}
            >
              <h3>
                {editingId
                  ? "Edit Assignment"
                  : "Add Assignment"}
              </h3>

              <label>Title</label>
              <input
                name="title"
                value={form.title}
                onChange={handleChange}
                required
              />

              <label>Description</label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
              />

              <label>Deadline</label>
              <input
                type="date"
                name="deadline"
                value={form.deadline}
                onChange={handleChange}
                required
              />

              <label>Subject</label>
              <select
                name="subject_id"
                value={form.subject_id}
                onChange={handleChange}
                required
              >
                <option value="">
                  Select subject
                </option>

                {subjects.map((subject) => (
                  <option
                    key={subject.id}
                    value={subject.id}
                  >
                    {subject.name}
                  </option>
                ))}
              </select>

              <label>Priority</label>
              <select
                name="priority"
                value={form.priority}
                onChange={handleChange}
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>

              <label>Status</label>
              <select
                name="status"
                value={form.status}
                onChange={handleChange}
              >
                <option value="Pending">
                  Pending
                </option>

                <option value="Completed">
                  Completed
                </option>
              </select>

              <div className="form-actions">
                <button type="submit">
                  {editingId ? "Update" : "Create"}
                </button>

                <button
                  type="button"
                  className="cancel-button"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {loading && <p>Loading assignments...</p>}

          <div className="assignment-grid">
            {assignments.map((assignment) => (
              <article
                className="assignment-card"
                key={assignment.id}
              >
                <div className="card-top">
                  <span className="subject">
                    {assignment.subject_name}
                  </span>

                  <span
                    className={`status ${assignment.status.toLowerCase()}`}
                  >
                    {assignment.status}
                  </span>
                </div>

                <h3>{assignment.title}</h3>

                <p className="description">
                  {assignment.description}
                </p>

                <div className="assignment-info">
                  <p>
                    <strong>Deadline:</strong>{" "}
                    {formatDate(assignment.deadline)}
                  </p>

                  <p>
                    <strong>Priority:</strong>{" "}
                    <span
                      className={`priority ${assignment.priority.toLowerCase()}`}
                    >
                      {assignment.priority}
                    </span>
                  </p>
                </div>

                <div className="card-actions">
                                    <button
                    className="notes-button"
                    onClick={() => openNotes(assignment)}
                  >
                    Notes
                  </button>
                  <button
                    className="edit-button"
                    onClick={() =>
                      openEditForm(assignment)
                    }
                  >
                    Edit
                  </button>

                  <button
                    className="delete-button"
                    onClick={() =>
                      handleDelete(assignment.id)
                    }
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
          {selectedAssignment && (
  <div className="notes-panel">
    <div className="notes-header">
      <div>
        <h3>Notes</h3>
        <p>{selectedAssignment.title}</p>
      </div>

      <button
        onClick={() => setSelectedAssignment(null)}
      >
        Close
      </button>
    </div>

    <div className="note-input">
      <input
        type="text"
        placeholder="Write a note..."
        value={noteContent}
        onChange={(e) => setNoteContent(e.target.value)}
      />

      <button onClick={addNote}>
        Add Note
      </button>
    </div>

    {notes.length === 0 && (
      <p>No notes yet.</p>
    )}

    <div className="notes-list">
      {notes.map((note) => (
        <div
          className="note-item"
          key={note._id}
        >
          <div>
            <p>{note.content}</p>

            <small>
              {new Date(note.createdAt).toLocaleString("vi-VN")}
            </small>
          </div>

          <button
            onClick={() => deleteNote(note._id)}
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  </div>
)}
        </section>
        <section className="activity-section">
  <div className="section-header">
    <div>
      <h2>Activity History</h2>
      <p>Recent assignment activities</p>
    </div>
  </div>

  {activities.length === 0 ? (
    <p>No activity yet.</p>
  ) : (
    <div className="activity-list">
      {activities.map((activity) => (
        <div
          className="activity-item"
          key={activity._id}
        >
          <div className="activity-content">
            <span
              className={`activity-action ${activity.action.toLowerCase()}`}
            >
              {activity.action}
            </span>

            <div>
              <p>{activity.description}</p>

              <small>
                {new Date(activity.createdAt).toLocaleString("vi-VN")}
              </small>
            </div>
          </div>

          <span className="activity-id">
            Assignment #{activity.assignmentId}
          </span>
        </div>
      ))}
    </div>
  )}
</section>
      </main>
    </div>

  );
}

export default App;
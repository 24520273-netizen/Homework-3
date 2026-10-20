import { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:3000/api";
const TODAY = Date.now();
const emptyAssignment = { title: "", description: "", deadline: "", priority: "Medium", status: "Pending", subject_id: "" };
const emptySubject = { name: "", description: "" };

async function request(path, options) {
  let response;
  try {
    response = await fetch(`${API}${path}`, options);
  } catch {
    throw new Error("Could not reach the Study Planner server. Check that the backend is running.");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `Request failed (${response.status}).`);
  return data;
}

const json = (method, body) => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const dateLabel = (value) => value ? new Date(value).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" }) : "No deadline";
const dateTimeLabel = (value) => value ? new Date(value).toLocaleString("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";

function App() {
  const [assignments, setAssignments] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyAssignment);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [subjectFilter, setSubjectFilter] = useState("All subjects");
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [notes, setNotes] = useState([]);
  const [noteContent, setNoteContent] = useState("");
  const [notesLoading, setNotesLoading] = useState(false);
  const [noteError, setNoteError] = useState("");
  const [showSubjects, setShowSubjects] = useState(false);
  const [subjectForm, setSubjectForm] = useState(emptySubject);
  const [editingSubjectId, setEditingSubjectId] = useState(null);
  const [subjectError, setSubjectError] = useState("");

  const loadAssignments = useCallback(async () => setAssignments(await request("/assignments")), []);
  const loadSubjects = useCallback(async () => setSubjects(await request("/subjects")), []);
  const loadActivities = useCallback(async () => setActivities(await request("/activities")), []);
  const refreshAll = useCallback(async () => Promise.all([loadAssignments(), loadSubjects(), loadActivities()]), [loadAssignments, loadSubjects, loadActivities]);

  useEffect(() => {
    let active = true;
    const initialize = async () => {
      try { await refreshAll(); }
      catch (error) { if (active) setPageError(error.message); }
      finally { if (active) setLoading(false); }
    };
    initialize();
    return () => { active = false; };
  }, [refreshAll]);

  const filteredAssignments = useMemo(() => assignments.filter((assignment) => {
    const needle = query.trim().toLowerCase();
    return (!needle || [assignment.title, assignment.description, assignment.subject_name].some((value) => value?.toLowerCase().includes(needle)))
      && (statusFilter === "All statuses" || assignment.status === statusFilter)
      && (subjectFilter === "All subjects" || String(assignment.subject_id) === subjectFilter);
  }), [assignments, query, statusFilter, subjectFilter]);

  const total = assignments.length;
  const completed = assignments.filter((item) => item.status === "Completed").length;
  const pending = assignments.filter((item) => item.status === "Pending").length;
  const overdue = assignments.filter((item) => item.status !== "Completed" && item.deadline && new Date(item.deadline).setHours(23, 59, 59, 999) < TODAY).length;

  const openAddForm = () => {
    setEditingId(null);
    setForm({ ...emptyAssignment, subject_id: subjects[0]?.id ? String(subjects[0].id) : "" });
    setPageError("");
    setShowForm(true);
  };

  const openEditForm = (assignment) => {
    setEditingId(assignment.id);
    setForm({ title: assignment.title || "", description: assignment.description || "", deadline: assignment.deadline?.slice(0, 10) || "", priority: assignment.priority || "Medium", status: assignment.status || "Pending", subject_id: String(assignment.subject_id ?? "") });
    setPageError("");
    setShowForm(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setBusy(true); setPageError("");
    try {
      const body = { ...form, subject_id: Number(form.subject_id) };
      await request(editingId ? `/assignments/${editingId}` : "/assignments", json(editingId ? "PUT" : "POST", body));
      setShowForm(false); setEditingId(null); await Promise.all([loadAssignments(), loadActivities()]);
    } catch (error) { setPageError(error.message); }
    finally { setBusy(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this assignment? Its notes will remain in storage.")) return;
    setBusy(true); setPageError("");
    try { await request(`/assignments/${id}`, { method: "DELETE" }); await Promise.all([loadAssignments(), loadActivities()]); }
    catch (error) { setPageError(error.message); }
    finally { setBusy(false); }
  };

  const openNotes = async (assignment) => {
    setSelectedAssignment(assignment); setNotes([]); setNoteError(""); setNotesLoading(true);
    try { setNotes(await request(`/assignments/${assignment.id}/notes`)); }
    catch (error) { setNoteError(error.message); }
    finally { setNotesLoading(false); }
  };

  const addNote = async (event) => {
    event.preventDefault();
    if (!noteContent.trim() || !selectedAssignment) return;
    setNoteError("");
    try {
      await request(`/assignments/${selectedAssignment.id}/notes`, json("POST", { content: noteContent.trim() }));
      setNoteContent(""); await openNotes(selectedAssignment);
    } catch (error) { setNoteError(error.message); }
  };

  const deleteNote = async (noteId) => {
    setNoteError("");
    try { await request(`/assignments/${selectedAssignment.id}/notes/${noteId}`, { method: "DELETE" }); await openNotes(selectedAssignment); }
    catch (error) { setNoteError(error.message); }
  };

  const saveSubject = async (event) => {
    event.preventDefault(); setSubjectError("");
    try {
      await request(editingSubjectId ? `/subjects/${editingSubjectId}` : "/subjects", json(editingSubjectId ? "PUT" : "POST", subjectForm));
      setSubjectForm(emptySubject); setEditingSubjectId(null); await loadSubjects();
    } catch (error) { setSubjectError(error.message); }
  };

  const deleteSubject = async (id) => {
    if (!window.confirm("Delete this subject? The database may prevent deletion while assignments use it.")) return;
    setSubjectError("");
    try { await request(`/subjects/${id}`, { method: "DELETE" }); await Promise.all([loadSubjects(), loadAssignments()]); if (subjectFilter === String(id)) setSubjectFilter("All subjects"); }
    catch (error) { setSubjectError(error.message); }
  };

  return <div className="app-shell">
    <header className="topbar"><div className="topbar-inner">
      <a className="brand" href="#top" aria-label="Study Planner home"><span className="brand-mark">S</span><span>study<span className="brand-light">space</span><small>YOUR PERSONAL PLANNER</small></span></a>
      <nav className="top-nav" aria-label="Main navigation"><a href="#assignments">Assignments</a><a href="#subjects" onClick={() => setShowSubjects(true)}>Subjects</a><a href="#activity">Activity</a></nav>
      <button className="button button-primary top-add" onClick={openAddForm}>＋ <span>New assignment</span></button>
    </div></header>

    <main className="page-wrap" id="top">
      <section className="welcome-row"><div><p className="eyebrow">YOUR ACADEMIC OVERVIEW</p><h1>Good to see you <span>👋</span></h1><p className="welcome-copy">A little progress each day adds up to big results.</p></div><button className="button button-outline" onClick={() => { setShowSubjects((visible) => !visible); setSubjectError(""); }}>▦ <span>Manage subjects</span></button></section>

      {pageError && <div className="alert" role="alert"><span>{pageError}</span><button onClick={() => setPageError("")} aria-label="Dismiss error">×</button></div>}

      <section className="stats-grid" aria-label="Assignment summary">
        <article className="stat-card"><div className="stat-icon lavender">▤</div><div><span>Total assignments</span><strong>{total}</strong><small>Across all your subjects</small></div></article>
        <article className="stat-card"><div className="stat-icon amber">◷</div><div><span>Pending</span><strong>{pending}</strong><small>Still on your to do list</small></div></article>
        <article className="stat-card"><div className="stat-icon green">✓</div><div><span>Completed</span><strong>{completed}</strong><small>Nice work, keep it up</small></div></article>
        <article className="stat-card"><div className="stat-icon rose">⌛</div><div><span>Overdue</span><strong>{overdue}</strong><small>Past the due date</small></div></article>
      </section>

      {showSubjects && <section className="panel subjects-panel" id="subjects">
        <div className="section-heading"><div><p className="eyebrow">STAY ORGANIZED</p><h2>Subjects</h2><p className="section-subtitle">Keep your courses and coursework in one place.</p></div><button className="icon-button" onClick={() => setShowSubjects(false)} aria-label="Close subjects">×</button></div>
        <form className="subject-form" onSubmit={saveSubject}><label>Subject name<input required maxLength="100" placeholder="e.g. Web Development" value={subjectForm.name} onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}/></label><label>Description <span className="optional">(optional)</span><input placeholder="A short description" value={subjectForm.description} onChange={(e) => setSubjectForm({ ...subjectForm, description: e.target.value })}/></label><div className="subject-form-actions"><button className="button button-primary" type="submit">{editingSubjectId ? "Save changes" : "+ Add subject"}</button>{editingSubjectId && <button className="button button-outline" type="button" onClick={() => { setEditingSubjectId(null); setSubjectForm(emptySubject); }}>Cancel</button>}</div></form>
        {subjectError && <div className="alert compact" role="alert">{subjectError}</div>}
        {subjects.length ? <div className="subject-grid">{subjects.map((subject, index) => <article className="subject-card" key={subject.id}><span className={`subject-dot dot-${index % 5}`}/><div className="subject-card-copy"><h3>{subject.name}</h3><p>{subject.description || "No description added"}</p><small>{assignments.filter((a) => String(a.subject_id) === String(subject.id)).length} assignments</small></div><div className="subject-actions"><button onClick={() => { setEditingSubjectId(subject.id); setSubjectForm({ name: subject.name || "", description: subject.description || "" }); }} aria-label={`Edit ${subject.name}`}>Edit</button><button className="text-danger" onClick={() => deleteSubject(subject.id)} aria-label={`Delete ${subject.name}`}>Delete</button></div></article>)}</div> : <div className="empty-state small-empty"><span className="empty-icon">▦</span><h3>No subjects yet</h3><p>Add your first subject to organize assignments.</p></div>}
      </section>}

      <section className="panel assignments-panel" id="assignments">
        <div className="section-heading"><div><p className="eyebrow">PLAN YOUR WORK</p><h2>Assignments <span className="count-pill">{filteredAssignments.length}</span></h2><p className="section-subtitle">Track deadlines and make steady progress.</p></div><button className="button button-primary" onClick={openAddForm}>＋ <span>Add assignment</span></button></div>

        <div className="toolbar"><label className="search-box"><span aria-hidden="true">⌕</span><input type="search" placeholder="Search assignments..." value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search assignments"/><kbd>⌘ K</kbd></label><label className="filter-select"><span>Status</span><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option>All statuses</option><option>Pending</option><option>Completed</option></select></label><label className="filter-select"><span>Subject</span><select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)}><option value="All subjects">All subjects</option>{subjects.map((s) => <option value={String(s.id)} key={s.id}>{s.name}</option>)}</select></label></div>

        {showForm && <form className="assignment-form" onSubmit={handleSubmit}><div className="form-heading"><div><p className="eyebrow">ASSIGNMENT DETAILS</p><h3>{editingId ? "Edit assignment" : "Create an assignment"}</h3></div><button className="icon-button" type="button" onClick={() => setShowForm(false)} aria-label="Close form">×</button></div><div className="form-grid"><label className="field-wide">Title<input name="title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Research paper draft" required maxLength="150"/></label><label className="field-wide">Description <span className="optional">(optional)</span><textarea name="description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Add a few details to help you get started" rows="3"/></label><label>Due date<input type="date" name="deadline" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} required/></label><label>Subject<select name="subject_id" value={form.subject_id} onChange={(e) => setForm({ ...form, subject_id: e.target.value })} required disabled={!subjects.length}><option value="">{subjects.length ? "Choose a subject" : "Add a subject first"}</option>{subjects.map((subject) => <option value={subject.id} key={subject.id}>{subject.name}</option>)}</select></label><label>Priority<select name="priority" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}><option>Low</option><option>Medium</option><option>High</option></select></label><label>Status<select name="status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option>Pending</option><option>Completed</option></select></label></div><div className="form-footer"><button className="button button-primary" type="submit" disabled={busy || !subjects.length}>{busy ? "Saving…" : editingId ? "Save changes" : "Create assignment"}</button><button className="button button-outline" type="button" onClick={() => setShowForm(false)}>Cancel</button></div></form>}

        {loading ? <div className="empty-state"><span className="loading-spinner"/><h3>Loading your assignments</h3><p>Just a moment while we get things ready.</p></div> : filteredAssignments.length === 0 ? <div className="empty-state"><span className="empty-icon">{assignments.length ? "⌕" : "✎"}</span><h3>{assignments.length ? "No matching assignments" : "A fresh start"}</h3><p>{assignments.length ? "Try changing your search or filters." : "Add an assignment to start planning your coursework."}</p>{assignments.length ? <button className="button button-outline" onClick={() => { setQuery(""); setStatusFilter("All statuses"); setSubjectFilter("All subjects"); }}>Clear filters</button> : <button className="button button-primary" onClick={openAddForm}>＋ Add your first assignment</button>}</div> : <div className="assignment-grid">{filteredAssignments.map((assignment) => { const isOverdue = assignment.status !== "Completed" && assignment.deadline && new Date(assignment.deadline).setHours(23,59,59,999) < TODAY; return <article className="assignment-card" key={assignment.id}><div className="assignment-card-top"><span className="subject-label"><i/> {assignment.subject_name || "Unassigned"}</span><span className={`badge status-badge ${assignment.status.toLowerCase()}`}><i/>{assignment.status}</span></div><h3>{assignment.title}</h3><p className="assignment-description">{assignment.description || "No description provided."}</p><div className="assignment-meta"><div className={isOverdue ? "due-date overdue-date" : "due-date"}><span className="meta-icon">◷</span><span><small>{isOverdue ? "Overdue" : "Due date"}</small><strong>{dateLabel(assignment.deadline)}</strong></span></div><span className={`badge priority-badge ${assignment.priority.toLowerCase()}`}><i/>{assignment.priority} priority</span></div><div className="assignment-actions"><button className="notes-link" onClick={() => openNotes(assignment)}>▤ Notes</button><div><button className="action-button" onClick={() => openEditForm(assignment)}>Edit</button><button className="action-button delete-action" onClick={() => handleDelete(assignment.id)} disabled={busy}>Delete</button></div></div></article>; })}</div>}
      </section>

      {selectedAssignment && <section className="panel notes-panel" aria-label="Assignment notes"><div className="section-heading"><div><p className="eyebrow">QUICK THOUGHTS</p><h2>Notes <span className="notes-for">for {selectedAssignment.title}</span></h2><p className="section-subtitle">Keep useful ideas close to the assignment.</p></div><button className="icon-button" onClick={() => { setSelectedAssignment(null); setNoteContent(""); }} aria-label="Close notes">×</button></div><form className="note-compose" onSubmit={addNote}><input aria-label="Note content" placeholder="Write a note or reminder..." value={noteContent} onChange={(e) => setNoteContent(e.target.value)} maxLength="1000"/><button className="button button-primary" type="submit" disabled={!noteContent.trim()}>Add note</button></form>{noteError && <div className="alert compact" role="alert">{noteError}</div>}{notesLoading ? <p className="inline-loading">Loading notes…</p> : notes.length ? <div className="notes-list">{notes.map((note) => <article className="note-item" key={note._id}><span className="note-pin">✦</span><div><p>{note.content}</p><small>{dateTimeLabel(note.createdAt)}</small></div><button className="icon-button note-delete" onClick={() => deleteNote(note._id)} aria-label="Delete note">×</button></article>)}</div> : <div className="empty-state compact-empty"><h3>No notes yet</h3><p>Save a thought or reminder for this assignment.</p></div>}</section>}

      <section className="panel activity-panel" id="activity"><div className="section-heading"><div><p className="eyebrow">YOUR RECENT PROGRESS</p><h2>Activity history</h2><p className="section-subtitle">A timeline of changes to your assignments.</p></div></div>{activities.length ? <div className="activity-list">{activities.map((activity) => { const action = (activity.action || "").toUpperCase(); const label = action === "CREATE" ? "Created" : action === "UPDATE" ? "Updated" : action === "DELETE" ? "Deleted" : action; return <article className="activity-item" key={activity._id}><span className={`activity-marker ${action.toLowerCase()}`}>{action === "CREATE" ? "+" : action === "UPDATE" ? "↻" : "×"}</span><div className="activity-copy"><div><span className={`activity-action ${action.toLowerCase()}`}>{label}</span><span className="activity-description">{activity.description}</span></div><small>{dateTimeLabel(activity.createdAt)}</small></div><span className="activity-id">Assignment #{activity.assignmentId}</span></article>; })}</div> : <div className="empty-state compact-empty"><span className="empty-icon">↻</span><h3>No activity yet</h3><p>Assignment updates will appear here.</p></div>}</section>
      <footer className="page-footer">Made for your next big idea <span>✦</span></footer>
    </main>
  </div>;
}

export default App;

import { useEffect, useState, useMemo } from 'react';
import { collection, doc, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useClub } from '../context/ClubContext';
import { useAuth } from '../context/AuthContext';
import { ListChecks, ClipboardList, CheckCircle, Clock, AlertTriangle, UserCheck, Calendar } from 'lucide-react';

export default function UserTasks() {
  const { selectedClubId, selectedClub } = useClub();
  const { user, profile } = useAuth();
  
  const [tasks, setTasks] = useState([]);
  const [rosters, setRosters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('tasks'); // 'tasks', 'shifts', 'volunteer'

  const fetchTasksData = async () => {
    if (!selectedClubId) return;
    setLoading(true);
    try {
      const [tasksSnap, rostersSnap] = await Promise.all([
        getDocs(collection(db, 'clubs', selectedClubId, 'tasks')),
        getDocs(collection(db, 'clubs', selectedClubId, 'rosters'))
      ]);

      setTasks(tasksSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setRosters(rostersSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Error fetching operational duties:', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTasksData();
  }, [selectedClubId]);

  // Tasks assigned to this specific user (e.g. by displayName or uid if matched)
  const myTasks = useMemo(() => {
    return tasks.filter(t => {
      const isUidMatch = t.assigneeId === user?.uid;
      const isNameMatch = String(t.assigneeName || '').trim().toLowerCase() === String(profile?.displayName || '').trim().toLowerCase();
      return isUidMatch || isNameMatch;
    });
  }, [tasks, user, profile]);

  // Shifts this user has signed up for
  const myShifts = useMemo(() => {
    const list = [];
    rosters.forEach(r => {
      (r.shifts || []).forEach(s => {
        if (s.filledBy === user?.uid) {
          list.push({
            ...s,
            rosterId: r.id,
            rosterTitle: r.title,
            date: r.date
          });
        }
      });
    });
    // Sort shifts by date
    return list.sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [rosters, user]);

  // Open / Unfilled Shifts in the club
  const openShifts = useMemo(() => {
    const list = [];
    rosters.forEach(r => {
      (r.shifts || []).forEach(s => {
        if (!s.filledBy) {
          list.push({
            ...s,
            rosterId: r.id,
            rosterTitle: r.title,
            date: r.date
          });
        }
      });
    });
    // Sort shifts by date (only show upcoming or recent)
    return list.sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [rosters]);

  // Toggle checklist tasks completion status
  const handleToggleTask = async (taskItem) => {
    try {
      const taskRef = doc(db, 'clubs', selectedClubId, 'tasks', taskItem.id);
      const newStatus = taskItem.status === 'completed' ? 'pending' : 'completed';
      await updateDoc(taskRef, { status: newStatus });
      
      // Update local state
      setTasks(prev => prev.map(t => t.id === taskItem.id ? { ...t, status: newStatus } : t));
    } catch (err) {
      alert('Failed to update task: ' + err.message);
    }
  };

  // Sign up for an open shift
  const handleShiftSignUp = async (shiftItem) => {
    if (!user) return;
    try {
      const rosterRef = doc(db, 'clubs', selectedClubId, 'rosters', shiftItem.rosterId);
      const rosterItem = rosters.find(r => r.id === shiftItem.rosterId);
      if (!rosterItem) return;

      const updatedShifts = rosterItem.shifts.map(s => {
        if (s.role === shiftItem.role && s.startTime === shiftItem.startTime && s.endTime === shiftItem.endTime) {
          return {
            ...s,
            filledBy: user.uid,
            filledByName: profile?.displayName || 'Club Member'
          };
        }
        return s;
      });

      await updateDoc(rosterRef, { shifts: updatedShifts });
      
      // Update local state
      setRosters(prev => prev.map(r => r.id === shiftItem.rosterId ? { ...r, shifts: updatedShifts } : r));
      alert(`Successfully signed up as ${shiftItem.role}!`);
    } catch (err) {
      alert('Failed to sign up: ' + err.message);
    }
  };

  // Opt-out / Cancel shift signup
  const handleShiftResign = async (shiftItem) => {
    if (!user) return;
    if (!window.confirm('Are you sure you want to cancel your signup for this volunteer shift?')) return;
    try {
      const rosterRef = doc(db, 'clubs', selectedClubId, 'rosters', shiftItem.rosterId);
      const rosterItem = rosters.find(r => r.id === shiftItem.rosterId);
      if (!rosterItem) return;

      const updatedShifts = rosterItem.shifts.map(s => {
        if (s.role === shiftItem.role && s.startTime === shiftItem.startTime && s.endTime === shiftItem.endTime) {
          return {
            ...s,
            filledBy: '',
            filledByName: ''
          };
        }
        return s;
      });

      await updateDoc(rosterRef, { shifts: updatedShifts });
      
      // Update local state
      setRosters(prev => prev.map(r => r.id === shiftItem.rosterId ? { ...r, shifts: updatedShifts } : r));
      alert('You have successfully opted out of this shift.');
    } catch (err) {
      alert('Failed to resign: ' + err.message);
    }
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px' }}>
      
      {/* Header */}
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <div>
          <h1>Duties & Shifts</h1>
          <p className="subtitle">Sign up for volunteer rosters, complete checklist tasks, and manage operational duties for {selectedClub?.name}</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '24px' }}>
        <button
          onClick={() => setActiveTab('tasks')}
          style={{
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'tasks' ? '2px solid var(--primary)' : 'none',
            color: activeTab === 'tasks' ? 'var(--primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'tasks' ? 700 : 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px'
          }}
        >
          <ListChecks size={16} /> My Tasks ({myTasks.length})
        </button>
        <button
          onClick={() => setActiveTab('shifts')}
          style={{
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'shifts' ? '2px solid var(--primary)' : 'none',
            color: activeTab === 'shifts' ? 'var(--primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'shifts' ? 700 : 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px'
          }}
        >
          <UserCheck size={16} /> My Shifts ({myShifts.length})
        </button>
        <button
          onClick={() => setActiveTab('volunteer')}
          style={{
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'volunteer' ? '2px solid var(--primary)' : 'none',
            color: activeTab === 'volunteer' ? 'var(--primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'volunteer' ? 700 : 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px'
          }}
        >
          <ClipboardList size={16} /> Volunteer Openings ({openShifts.length})
        </button>
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '40px' }}>Loading operational details...</p>
      ) : (
        <div>
          
          {/* TAB 1: MY CHECKLIST TASKS */}
          {activeTab === 'tasks' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {myTasks.length === 0 ? (
                <div className="card text-center" style={{ padding: '60px 20px', border: '1px solid var(--border)', background: '#ffffff', borderRadius: '16px' }}>
                  <CheckCircle size={40} style={{ color: 'var(--primary)', marginBottom: '16px' }} />
                  <h3 style={{ margin: 0, color: 'var(--text)' }}>All Clear!</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '6px' }}>
                    You have no checklist tasks currently assigned to your account. Great job!
                  </p>
                </div>
              ) : (
                myTasks.map(task => {
                  const isCompleted = task.status === 'completed';
                  return (
                    <div
                      key={task.id}
                      className="card shadow-sm"
                      style={{
                        padding: '18px 20px',
                        border: '1px solid var(--border)',
                        background: '#ffffff',
                        borderRadius: '16px',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '14px',
                        opacity: isCompleted ? 0.6 : 1,
                        transition: 'opacity 0.2s'
                      }}
                    >
                      <button
                        onClick={() => handleToggleTask(task)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          marginTop: '2px',
                          padding: 0
                        }}
                      >
                        <div style={{
                          width: '22px',
                          height: '22px',
                          borderRadius: '6px',
                          border: `2px solid ${isCompleted ? 'var(--primary)' : 'var(--border)'}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: isCompleted ? 'var(--primary)' : 'transparent',
                          color: '#ffffff'
                        }}>
                          {isCompleted && <CheckCircle size={16} fill="none" strokeWidth={3} />}
                        </div>
                      </button>

                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '6px',
                            background: task.priority === 'high' ? '#fee2e2' : (task.priority === 'medium' ? '#fef3c7' : '#f1f5f9'),
                            color: task.priority === 'high' ? '#b91c1c' : (task.priority === 'medium' ? '#d97706' : '#64748b'),
                            textTransform: 'uppercase'
                          }}>
                            {task.priority || 'medium'} priority
                          </span>
                          {task.dueDate && (
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Calendar size={12} /> Due: {task.dueDate}
                            </span>
                          )}
                        </div>

                        <h3 style={{
                          margin: '0 0 4px 0',
                          fontSize: '15px',
                          fontWeight: 700,
                          textDecoration: isCompleted ? 'line-through' : 'none',
                          color: 'var(--text)'
                        }}>
                          {task.title}
                        </h3>

                        {task.description && (
                          <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                            {task.description}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 2: MY SIGNED UP SHIFTS */}
          {activeTab === 'shifts' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {myShifts.length === 0 ? (
                <div className="card text-center" style={{ padding: '60px 20px', border: '1px solid var(--border)', background: '#ffffff', borderRadius: '16px' }}>
                  <UserCheck size={40} style={{ color: 'var(--text-lighter)', marginBottom: '16px' }} />
                  <h3 style={{ margin: 0, color: 'var(--text)' }}>No Shifts Registered</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '6px', maxWidth: '350px', marginInline: 'auto' }}>
                    You haven't signed up for any shifts yet. Browse the "Volunteer Openings" tab to see where you can help out!
                  </p>
                </div>
              ) : (
                myShifts.map((shift, idx) => (
                  <div
                    key={`my-shift-${idx}`}
                    className="card shadow-sm"
                    style={{
                      padding: '20px',
                      border: '1px solid var(--border)',
                      background: 'rgba(16, 185, 129, 0.03)',
                      borderRadius: '16px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <span style={{ fontSize: '10px', background: 'var(--primary)', color: '#ffffff', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', textTransform: 'uppercase' }}>
                          Registered
                        </span>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Calendar size={12} /> {shift.date}
                        </span>
                      </div>
                      
                      <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 700, color: 'var(--text)' }}>
                        {shift.role}
                      </h3>
                      <p style={{ margin: '0 0 6px 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        Event: {shift.rosterTitle}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        <Clock size={12} /> <span>{shift.startTime} - {shift.endTime}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleShiftResign(shift)}
                      className="btn btn-outline"
                      style={{ border: '1px solid #ef4444', color: '#ef4444', padding: '8px 16px', fontSize: '12px', borderRadius: '10px' }}
                    >
                      Opt Out
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 3: OPEN VOLUNTEER OPENINGS */}
          {activeTab === 'volunteer' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {openShifts.length === 0 ? (
                <div className="card text-center" style={{ padding: '60px 20px', border: '1px solid var(--border)', background: '#ffffff', borderRadius: '16px' }}>
                  <AlertTriangle size={40} style={{ color: 'var(--text-lighter)', marginBottom: '16px' }} />
                  <h3 style={{ margin: 0, color: 'var(--text)' }}>All Shifts Filled</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '6px' }}>
                    All volunteer shifts are currently filled. Check back later for new openings!
                  </p>
                </div>
              ) : (
                openShifts.map((shift, idx) => (
                  <div
                    key={`open-shift-${idx}`}
                    className="card shadow-sm"
                    style={{
                      padding: '20px',
                      border: '1px solid var(--border)',
                      background: '#ffffff',
                      borderRadius: '16px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <span style={{ fontSize: '10px', background: '#dbeafe', color: '#1e40af', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', textTransform: 'uppercase' }}>
                          Open Position
                        </span>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Calendar size={12} /> {shift.date}
                        </span>
                      </div>
                      
                      <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 700, color: 'var(--text)' }}>
                        {shift.role}
                      </h3>
                      <p style={{ margin: '0 0 6px 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        Event: {shift.rosterTitle}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        <Clock size={12} /> <span>{shift.startTime} - {shift.endTime}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleShiftSignUp(shift)}
                      className="btn btn-primary"
                      style={{ padding: '8px 16px', fontSize: '12px', borderRadius: '10px' }}
                    >
                      Sign Up
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

        </div>
      )}

    </div>
  );
}

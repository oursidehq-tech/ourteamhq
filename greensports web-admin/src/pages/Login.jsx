import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, KeyRound, Lock, User, UserPlus, LogIn, Sparkles, Trophy, Users, Mail, Phone, Eye, EyeOff, Building, MapPin, Activity } from 'lucide-react';

export default function Login() {
  const [activeTab, setActiveTab] = useState('signin'); // 'signin' or 'signup'
  const [portalType, setPortalType] = useState('user'); // 'user' or 'admin'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('login'); // 'login' or 'pin' (for admins)
  
  // Sign up state wizard
  const [signupStep, setSignupStep] = useState(1);
  const [fullName, setFullName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedRole, setSelectedRole] = useState('Player'); // 'Player', 'Coach', 'Parent', 'Club Owner'
  const [inviteCode, setInviteCode] = useState('');
  const [newClubName, setNewClubName] = useState('');
  const [newClubSport, setNewClubSport] = useState('Soccer');
  const [newClubLocation, setNewClubLocation] = useState('');

  const { login, signUp, joinClubWithCode, createClubOnboarding, profile, isSuperAdmin, isPinVerified, verifyPin, authError, setPortalMode } = useAuth();
  const navigate = useNavigate();

  const handleSignIn = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    if (portalType === 'admin') {
      if (step === 'login') {
        const ok = await login(email.trim(), password, false);
        if (ok) {
          // Keep step as login, the AuthContext useEffect will switch to 'pin' if profile loaded and not pinVerified
        }
      } else {
        const ok = verifyPin(pin);
        if (ok) {
          setPortalMode('admin');
          navigate('/dashboard');
        } else {
          alert('Invalid Security PIN. Please try again.');
        }
      }
    } else {
      // User Portal
      const ok = await login(email.trim(), password, true);
      if (ok) {
        setPortalMode('user');
        navigate('/dashboard');
      }
    }
    setLoading(false);
  };

  const handleSignUpStep1 = (e) => {
    e.preventDefault();
    if (!fullName || !signupEmail || !signupPassword) {
      alert('Please fill out all required fields.');
      return;
    }
    setSignupStep(2);
  };

  const handleSignUpStep2 = () => {
    setSignupStep(3);
  };

  const handleSignUpSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const user = await signUp(signupEmail.trim(), signupPassword, fullName, phone, selectedRole);
      if (user) {
        if (selectedRole === 'Club Owner') {
          if (!newClubName) {
            alert('Please specify your club name.');
            setLoading(false);
            return;
          }
          const clubId = await createClubOnboarding(newClubName, newClubSport, newClubLocation);
          if (clubId) {
            setPortalMode('user');
            navigate('/dashboard');
          }
        } else {
          if (!inviteCode) {
            alert('Please enter a 6-digit invite code to join a club.');
            setLoading(false);
            return;
          }
          const club = await joinClubWithCode(inviteCode);
          if (club) {
            setPortalMode('user');
            navigate('/dashboard');
          }
        }
      }
    } catch (err) {
      alert(err.message || 'Onboarding failed.');
    }
    setLoading(false);
  };

  useEffect(() => {
    if (profile) {
      if (portalType === 'admin') {
        if (!isPinVerified) {
          setStep('pin');
        } else {
          setPortalMode('admin');
          navigate('/dashboard');
        }
      } else {
        setPortalMode('user');
        navigate('/dashboard');
      }
    }
  }, [profile, isPinVerified, navigate, portalType]);

  return (
    <div className="login-page-premium" style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #064e3b 100%)',
      padding: '24px',
      fontFamily: 'Inter, sans-serif',
      color: '#f8fafc',
      overflowY: 'auto'
    }}>
      <div className="glass-login-card" style={{
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '24px',
        width: '100%',
        maxWidth: activeTab === 'signup' && signupStep === 2 ? '800px' : '540px',
        padding: '40px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        transition: 'all 0.4s ease-in-out',
        margin: 'auto'
      }}>
        {/* Brand Header */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '32px', textAlign: 'center' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            marginBottom: '16px',
            boxShadow: '0 8px 24px rgba(16, 185, 129, 0.3)'
          }}>
            <Shield size={32} strokeWidth={2.5} fill="#ffffff" fillOpacity={0.2} />
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: 800, margin: 0, letterSpacing: '-0.75px', background: 'linear-gradient(to right, #ffffff, #a7f3d0)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            OurTeamHQ
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '14px', marginTop: '6px', fontWeight: 500 }}>
            GreenSports Standalone Web Platform
          </p>
        </div>

        {/* Action Tabs */}
        {step !== 'pin' && (
          <div style={{
            display: 'flex',
            background: 'rgba(255, 255, 255, 0.04)',
            borderRadius: '14px',
            padding: '4px',
            marginBottom: '28px',
            border: '1px solid rgba(255, 255, 255, 0.05)'
          }}>
            <button
              onClick={() => { setActiveTab('signin'); setSignupStep(1); }}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '10px',
                border: 'none',
                background: activeTab === 'signin' ? '#10b981' : 'transparent',
                color: activeTab === 'signin' ? '#ffffff' : '#94a3b8',
                fontWeight: 600,
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'all 0.3s'
              }}
            >
              <LogIn size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
              Sign In
            </button>
            <button
              onClick={() => { setActiveTab('signup'); }}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '10px',
                border: 'none',
                background: activeTab === 'signup' ? '#10b981' : 'transparent',
                color: activeTab === 'signup' ? '#ffffff' : '#94a3b8',
                fontWeight: 600,
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'all 0.3s'
              }}
            >
              <UserPlus size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
              Create Account
            </button>
          </div>
        )}

        {/* Tab content: Sign In */}
        {activeTab === 'signin' && (
          <form onSubmit={handleSignIn}>
            {step === 'login' ? (
              <>
                {/* Portal Type Switcher */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '12px',
                  marginBottom: '24px'
                }}>
                  <div
                    onClick={() => setPortalType('user')}
                    style={{
                      padding: '16px',
                      borderRadius: '16px',
                      background: portalType === 'user' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                      border: `1px solid ${portalType === 'user' ? '#10b981' : 'rgba(255, 255, 255, 0.05)'}`,
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'all 0.2s',
                    }}
                  >
                    <User size={24} color={portalType === 'user' ? '#10b981' : '#94a3b8'} style={{ marginBottom: '8px' }} />
                    <div style={{ fontWeight: 600, fontSize: '13px', color: portalType === 'user' ? '#f8fafc' : '#94a3b8' }}>Member Portal</div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Players, Coaches, Parents</div>
                  </div>
                  <div
                    onClick={() => setPortalType('admin')}
                    style={{
                      padding: '16px',
                      borderRadius: '16px',
                      background: portalType === 'admin' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                      border: `1px solid ${portalType === 'admin' ? '#10b981' : 'rgba(255, 255, 255, 0.05)'}`,
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'all 0.2s',
                    }}
                  >
                    <Lock size={24} color={portalType === 'admin' ? '#10b981' : '#94a3b8'} style={{ marginBottom: '8px' }} />
                    <div style={{ fontWeight: 600, fontSize: '13px', color: portalType === 'admin' ? '#f8fafc' : '#94a3b8' }}>Admin Center</div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Owners & Club Admins</div>
                  </div>
                </div>

                {authError && (
                  <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: '8px', color: '#fca5a5', fontSize: '13px', marginBottom: '16px', textAlign: 'center' }}>
                    {authError}
                  </div>
                )}
                {/* Fields */}
                <div style={{ marginBottom: '16px', position: 'relative' }}>
                  <Mail size={18} style={{ position: 'absolute', left: '16px', top: '16px', color: '#64748b' }} />
                  <input
                    type="email"
                    placeholder="Email Address"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '16px 16px 16px 48px',
                      borderRadius: '14px',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      background: 'rgba(255, 255, 255, 0.03)',
                      color: '#ffffff',
                      fontSize: '14px',
                      outline: 'none',
                      boxSizing: 'border-box',
                      transition: 'all 0.3s'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '24px', position: 'relative' }}>
                  <Lock size={18} style={{ position: 'absolute', left: '16px', top: '16px', color: '#64748b' }} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '16px 48px 16px 48px',
                      borderRadius: '14px',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      background: 'rgba(255, 255, 255, 0.03)',
                      color: '#ffffff',
                      fontSize: '14px',
                      outline: 'none',
                      boxSizing: 'border-box',
                      transition: 'all 0.3s'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '16px',
                      top: '16px',
                      border: 'none',
                      background: 'none',
                      color: '#64748b',
                      cursor: 'pointer'
                    }}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '16px',
                    borderRadius: '14px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '15px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 16px rgba(16, 185, 129, 0.25)',
                    transition: 'all 0.3s'
                  }}
                >
                  {loading ? 'Authenticating...' : portalType === 'admin' ? 'Verify Admin Account' : 'Access Member Workspace'}
                </button>
              </>
            ) : (
              /* PIN STEP FOR ADMIN PORTAL */
              <div style={{ textAlign: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '16px', color: '#10b981' }}>
                  <Lock size={18} />
                  <span style={{ fontSize: '15px', fontWeight: 600 }}>Security Verification Required</span>
                </div>
                <p style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '24px', lineHeight: 1.5 }}>
                  Please enter the secure administrative access PIN to unlock full manager controls.
                </p>
                <div style={{ marginBottom: '24px', position: 'relative' }}>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={pin}
                    onChange={e => setPin(e.target.value)}
                    required
                    autoFocus
                    style={{
                      width: '100%',
                      padding: '16px',
                      borderRadius: '14px',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      background: 'rgba(255, 255, 255, 0.05)',
                      color: '#ffffff',
                      fontSize: '24px',
                      textAlign: 'center',
                      letterSpacing: '6px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '16px',
                    borderRadius: '14px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '15px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 16px rgba(16, 185, 129, 0.25)'
                  }}
                >
                  {loading ? 'Unlocking...' : 'Unlock Infrastructure Controls'}
                </button>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  style={{
                    width: '100%',
                    padding: '14px',
                    borderRadius: '14px',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    background: 'transparent',
                    color: '#94a3b8',
                    fontWeight: 600,
                    fontSize: '14px',
                    cursor: 'pointer',
                    marginTop: '12px'
                  }}
                >
                  Cancel
                </button>
              </div>
            )}
          </form>
        )}

        {/* Tab content: Sign Up Wizard */}
        {activeTab === 'signup' && (
          <div>
            {/* Step Indicators */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '32px' }}>
              {[1, 2, 3].map(s => (
                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: signupStep === s ? '#10b981' : (signupStep > s ? '#047857' : 'rgba(255, 255, 255, 0.05)'),
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '12px',
                    border: `1px solid ${signupStep === s ? '#10b981' : 'transparent'}`
                  }}>
                    {s}
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: signupStep === s ? '#f8fafc' : '#64748b' }}>
                    {s === 1 ? 'Profile' : s === 2 ? 'Role' : 'Onboard'}
                  </span>
                  {s < 3 && <div style={{ width: '20px', height: '1px', background: 'rgba(255, 255, 255, 0.08)' }}></div>}
                </div>
              ))}
            </div>

            {/* STEP 1: Account Creation */}
            {signupStep === 1 && (
              <form onSubmit={handleSignUpStep1}>
                <div style={{ marginBottom: '16px', position: 'relative' }}>
                  <User size={18} style={{ position: 'absolute', left: '16px', top: '16px', color: '#64748b' }} />
                  <input
                    type="text"
                    placeholder="Full Name"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '16px 16px 16px 48px',
                      borderRadius: '14px',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      background: 'rgba(255, 255, 255, 0.03)',
                      color: '#ffffff',
                      fontSize: '14px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '16px', position: 'relative' }}>
                  <Mail size={18} style={{ position: 'absolute', left: '16px', top: '16px', color: '#64748b' }} />
                  <input
                    type="email"
                    placeholder="Email Address"
                    value={signupEmail}
                    onChange={e => setSignupEmail(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '16px 16px 16px 48px',
                      borderRadius: '14px',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      background: 'rgba(255, 255, 255, 0.03)',
                      color: '#ffffff',
                      fontSize: '14px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '16px', position: 'relative' }}>
                  <Phone size={18} style={{ position: 'absolute', left: '16px', top: '16px', color: '#64748b' }} />
                  <input
                    type="text"
                    placeholder="Phone Number (Optional)"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '16px 16px 16px 48px',
                      borderRadius: '14px',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      background: 'rgba(255, 255, 255, 0.03)',
                      color: '#ffffff',
                      fontSize: '14px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '24px', position: 'relative' }}>
                  <Lock size={18} style={{ position: 'absolute', left: '16px', top: '16px', color: '#64748b' }} />
                  <input
                    type="password"
                    placeholder="Password (Min. 6 chars)"
                    value={signupPassword}
                    onChange={e => setSignupPassword(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '16px 16px 16px 48px',
                      borderRadius: '14px',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      background: 'rgba(255, 255, 255, 0.03)',
                      color: '#ffffff',
                      fontSize: '14px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <button
                  type="submit"
                  style={{
                    width: '100%',
                    padding: '16px',
                    borderRadius: '14px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '15px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 16px rgba(16, 185, 129, 0.25)'
                  }}
                >
                  Continue to Role Selection
                </button>
              </form>
            )}

            {/* STEP 2: Role Selection */}
            {signupStep === 2 && (
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px', textAlign: 'center' }}>Choose Your Role</h3>
                <p style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center', marginBottom: '24px' }}>
                  Select the profile category that matches your purpose on GreenSports.
                </p>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '16px',
                  marginBottom: '32px'
                }}>
                  {[
                    { id: 'Player', title: 'Club Player', desc: 'Join rosters, view feeds, matches, events', icon: Activity },
                    { id: 'Coach', title: 'Coach / Staff', desc: 'Organize training, check compliance, roster', icon: Trophy },
                    { id: 'Parent', title: 'Parent / Guardian', desc: 'Link players, track schedules, approve fees', icon: Users },
                    { id: 'Club Owner', title: 'Club Owner', desc: 'Create a brand new club dashboard', icon: Sparkles }
                  ].map(roleItem => {
                    const Icon = roleItem.icon;
                    return (
                      <div
                        key={roleItem.id}
                        onClick={() => setSelectedRole(roleItem.id)}
                        style={{
                          padding: '20px',
                          borderRadius: '18px',
                          background: selectedRole === roleItem.id ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                          border: `2px solid ${selectedRole === roleItem.id ? '#10b981' : 'rgba(255, 255, 255, 0.05)'}`,
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.2s',
                          boxShadow: selectedRole === roleItem.id ? '0 8px 24px rgba(16, 185, 129, 0.1)' : 'none'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                          <Icon size={24} color={selectedRole === roleItem.id ? '#10b981' : '#94a3b8'} />
                          {selectedRole === roleItem.id && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }}></div>}
                        </div>
                        <div style={{ fontWeight: 700, fontSize: '15px', color: '#f8fafc' }}>{roleItem.title}</div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px', lineHeight: 1.4 }}>{roleItem.desc}</div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    onClick={() => setSignupStep(1)}
                    style={{
                      flex: 1,
                      padding: '14px',
                      borderRadius: '14px',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      background: 'transparent',
                      color: '#94a3b8',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Back
                  </button>
                  <button
                    onClick={handleSignUpStep2}
                    style={{
                      flex: 2,
                      padding: '14px',
                      borderRadius: '14px',
                      border: 'none',
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      color: '#ffffff',
                      fontWeight: 700,
                      cursor: 'pointer',
                      boxShadow: '0 4px 16px rgba(16, 185, 129, 0.25)'
                    }}
                  >
                    Continue to Onboarding
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: Onboarding Action */}
            {signupStep === 3 && (
              <form onSubmit={handleSignUpSubmit}>
                {selectedRole === 'Club Owner' ? (
                  /* Create Club Flow */
                  <div>
                    <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '12px', textAlign: 'center' }}>Establish Your Club</h3>
                    <p style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center', marginBottom: '24px', lineHeight: 1.4 }}>
                      Enter your club identity below. We'll automatically generate your dashboard and 6-digit invitation codes.
                    </p>

                    <div style={{ marginBottom: '16px', position: 'relative' }}>
                      <Building size={18} style={{ position: 'absolute', left: '16px', top: '16px', color: '#64748b' }} />
                      <input
                        type="text"
                        placeholder="Club Name (e.g. GreenSports Academy)"
                        value={newClubName}
                        onChange={e => setNewClubName(e.target.value)}
                        required
                        style={{
                          width: '100%',
                          padding: '16px 16px 16px 48px',
                          borderRadius: '14px',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          background: 'rgba(255, 255, 255, 0.03)',
                          color: '#ffffff',
                          fontSize: '14px',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>

                    <div style={{ marginBottom: '16px', position: 'relative' }}>
                      <Trophy size={18} style={{ position: 'absolute', left: '16px', top: '16px', color: '#64748b' }} />
                      <select
                        value={newClubSport}
                        onChange={e => setNewClubSport(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '16px 16px 16px 48px',
                          borderRadius: '14px',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          background: '#0f172a',
                          color: '#ffffff',
                          fontSize: '14px',
                          outline: 'none',
                          boxSizing: 'border-box',
                          height: '52px'
                        }}
                      >
                        <option value="Soccer">Soccer</option>
                        <option value="Basketball">Basketball</option>
                        <option value="Cricket">Cricket</option>
                        <option value="Rugby">Rugby</option>
                        <option value="Tennis">Tennis</option>
                        <option value="Athletics">Athletics / General</option>
                      </select>
                    </div>

                    <div style={{ marginBottom: '24px', position: 'relative' }}>
                      <MapPin size={18} style={{ position: 'absolute', left: '16px', top: '16px', color: '#64748b' }} />
                      <input
                        type="text"
                        placeholder="Location / Region (Optional)"
                        value={newClubLocation}
                        onChange={e => setNewClubLocation(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '16px 16px 16px 48px',
                          borderRadius: '14px',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          background: 'rgba(255, 255, 255, 0.03)',
                          color: '#ffffff',
                          fontSize: '14px',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  /* Join Club Flow */
                  <div>
                    <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '12px', textAlign: 'center' }}>Connect to Your Club</h3>
                    <p style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center', marginBottom: '24px', lineHeight: 1.4 }}>
                      Enter the 6-digit invitation code generated by your club manager to link your profile instantly.
                    </p>

                    <div style={{ marginBottom: '24px', position: 'relative' }}>
                      <input
                        type="text"
                        placeholder="ABCDEF"
                        value={inviteCode}
                        onChange={e => setInviteCode(e.target.value.toUpperCase().trim())}
                        maxLength={6}
                        required
                        style={{
                          width: '100%',
                          padding: '16px',
                          borderRadius: '14px',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          background: 'rgba(255, 255, 255, 0.05)',
                          color: '#ffffff',
                          fontSize: '24px',
                          textAlign: 'center',
                          letterSpacing: '6px',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    type="button"
                    onClick={() => setSignupStep(2)}
                    style={{
                      flex: 1,
                      padding: '14px',
                      borderRadius: '14px',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      background: 'transparent',
                      color: '#94a3b8',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    style={{
                      flex: 2,
                      padding: '14px',
                      borderRadius: '14px',
                      border: 'none',
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      color: '#ffffff',
                      fontWeight: 700,
                      cursor: 'pointer',
                      boxShadow: '0 4px 16px rgba(16, 185, 129, 0.25)'
                    }}
                  >
                    {loading ? 'Processing Onboarding...' : selectedRole === 'Club Owner' ? 'Build Club & Launch' : 'Join Club & Active Workspace'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Global Error Banner */}
        {authError && (
          <div style={{
            marginTop: '20px',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            borderRadius: '12px',
            padding: '12px 16px',
            color: '#fca5a5',
            fontSize: '13px',
            fontWeight: 500,
            textAlign: 'center',
            lineHeight: 1.4
          }}>
            {authError}
          </div>
        )}

        <div style={{ fontSize: '11px', color: '#475569', marginTop: '28px', textAlign: 'center', lineHeight: 1.5 }}>
          Security verified by GreenSports Network. By signing in, you agree to our Terms of Use and Club Compliance policies.
        </div>
      </div>
    </div>
  );
}

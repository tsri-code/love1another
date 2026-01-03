'use client';

import { useState, useEffect, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { AvatarCircle } from '@/components/AvatarCircle';
import { VerseCard } from '@/components/VerseCard';
import { PrayerCard } from '@/components/PrayerCard';
import { AddPrayerComposer } from '@/components/AddPrayerComposer';
import { LockTimerBanner } from '@/components/LockTimerBanner';
import { AppHeader } from '@/components/AppHeader';
import { useToast } from '@/lib/toast';
import type { Prayer, PrayerCategory } from '@/lib/db';

interface Person {
  id: string;
  displayName: string;
  type: 'person' | 'group';
  avatarPath: string | null;
  avatarInitials: string | null;
  avatarColor: string | null;
  verseId: number;
}

interface PersonBasicInfo {
  id: string;
  displayName: string;
  avatarInitials: string | null;
  avatarColor: string | null;
  avatarPath: string | null;
}

interface LinkInfo {
  id: string;
  displayName: string;
  person1: PersonBasicInfo;
  person2: PersonBasicInfo;
  prayerCount: number;
  createdAt: string;
}

// Type for what we're currently viewing
type CurrentView = 
  | { type: 'person'; id: string }
  | { type: 'link'; linkId: string };

export default function PrayerListPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [person, setPerson] = useState<Person | null>(null);
  const [prayers, setPrayers] = useState<Prayer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingPrayer, setIsAddingPrayer] = useState(false);
  const [showDeletePerson, setShowDeletePerson] = useState(false);
  const [deleteConfirmPasscode, setDeleteConfirmPasscode] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [passcode, setPasscode] = useState<string | null>(null);
  const router = useRouter();
  const { showToast } = useToast();
  const menuRef = useRef<HTMLDivElement>(null);
  const switcherRef = useRef<HTMLDivElement>(null);
  const [showPersonMenu, setShowPersonMenu] = useState(false);
  
  // Link-related state
  const [links, setLinks] = useState<LinkInfo[]>([]);
  const [currentView, setCurrentView] = useState<CurrentView>({ type: 'person', id });
  const [showSwitcher, setShowSwitcher] = useState(false);

  // Get passcode from sessionStorage on mount
  useEffect(() => {
    const storedPasscode = sessionStorage.getItem(`passcode_${id}`);
    if (!storedPasscode) {
      // No passcode - redirect to unlock
      router.push(`/p/${id}`);
      return;
    }
    setPasscode(storedPasscode);
  }, [id, router]);

  useEffect(() => {
    if (passcode) {
      fetchData();
    }
  }, [id, passcode]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowPersonMenu(false);
      }
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) {
        setShowSwitcher(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchData = async () => {
    if (!passcode) return;
    
    try {
      const personRes = await fetch(`/api/people/${id}`);
      if (!personRes.ok) {
        router.push('/');
        return;
      }
      const personData = await personRes.json();
      setPerson(personData.person);
      
      // Store links for this person
      if (personData.links) {
        setLinks(personData.links);
      }

      // Fetch prayers based on current view
      await fetchPrayers();
    } catch (error) {
      console.error('Error fetching data:', error);
      router.push('/');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPrayers = async () => {
    if (!passcode) return;
    
    try {
      if (currentView.type === 'person') {
        const prayersRes = await fetch(`/api/people/${id}/prayers?p=${encodeURIComponent(passcode)}`);
        if (!prayersRes.ok) {
          router.push(`/p/${id}`);
          return;
        }
        const prayersData = await prayersRes.json();
        // Migrate old prayers without category
        const migratedPrayers = (prayersData.prayers || []).map((p: Prayer) => ({
          ...p,
          category: p.category || 'immediate',
          notAnsweredNote: p.notAnsweredNote || null,
        }));
        setPrayers(migratedPrayers);
      } else if (currentView.type === 'link') {
        // For links, use the person's passcode to decrypt the link's encryption key
        const prayersRes = await fetch(
          `/api/links/${currentView.linkId}/prayers?p=${encodeURIComponent(passcode)}&personId=${id}`
        );
        if (!prayersRes.ok) {
          // Failed to access link, go back to person view
          setCurrentView({ type: 'person', id });
          showToast('Could not access linked prayers', 'info');
          return;
        }
        const prayersData = await prayersRes.json();
        const migratedPrayers = (prayersData.prayers || []).map((p: Prayer) => ({
          ...p,
          category: p.category || 'immediate',
          notAnsweredNote: p.notAnsweredNote || null,
        }));
        setPrayers(migratedPrayers);
      }
    } catch (error) {
      console.error('Error fetching prayers:', error);
    }
  };
  
  // Refetch prayers when view changes
  useEffect(() => {
    if (person && passcode) {
      fetchPrayers();
    }
  }, [currentView]);

  // Helper to get the right API endpoint and passcode for current view
  const getCurrentApiInfo = () => {
    if (currentView.type === 'link') {
      return {
        baseUrl: `/api/links/${currentView.linkId}`,
        passcode: passcode, // Use person's passcode to decrypt link key
        personId: id,
        isLink: true,
      };
    }
    return {
      baseUrl: `/api/people/${id}`,
      passcode: passcode,
      personId: id,
      isLink: false,
    };
  };
  
  // Handle switching to a link view (no passcode needed - uses person's passcode)
  const handleSwitchToLink = (linkId: string) => {
    setCurrentView({ type: 'link', linkId });
    setShowSwitcher(false);
    showToast('Switched to linked prayers', 'success');
  };

  const handleAddPrayer = async (text: string, category: PrayerCategory) => {
    const apiInfo = getCurrentApiInfo();
    if (!apiInfo.passcode) return;
    
    setIsAddingPrayer(true);
    try {
      const bodyData: Record<string, unknown> = { 
        text, 
        passcode: apiInfo.passcode, 
        category 
      };
      // Include personId for link API calls
      if (apiInfo.isLink) {
        bodyData.personId = apiInfo.personId;
      }
      
      const res = await fetch(`${apiInfo.baseUrl}/prayers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData),
      });

      if (!res.ok) {
        if (res.status === 401) {
          if (currentView.type === 'link') {
            setCurrentView({ type: 'person', id });
            showToast('Link session expired', 'info');
          } else {
            router.push(`/p/${id}`);
          }
          return;
        }
        throw new Error('Failed to add prayer');
      }

      const data = await res.json();
      setPrayers(prev => [data.prayer, ...prev]);
      showToast('Prayer added', 'success');
    } catch (error) {
      console.error('Error adding prayer:', error);
      showToast('Failed to add prayer', 'error');
    } finally {
      setIsAddingPrayer(false);
    }
  };

  const handleUpdatePrayer = async (prayerId: string, updates: Partial<Prayer>) => {
    const apiInfo = getCurrentApiInfo();
    if (!apiInfo.passcode) {
      console.error('No passcode available for prayer update');
      showToast('Session expired. Please unlock again.', 'error');
      if (currentView.type === 'link') {
        setCurrentView({ type: 'person', id });
      } else {
        router.push(`/p/${id}`);
      }
      return;
    }
    
    try {
      const bodyData: Record<string, unknown> = { 
        ...updates, 
        passcode: apiInfo.passcode 
      };
      // Include personId for link API calls
      if (apiInfo.isLink) {
        bodyData.personId = apiInfo.personId;
      }
      
      const res = await fetch(`${apiInfo.baseUrl}/prayers/${prayerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData),
      });

      if (!res.ok) {
        if (res.status === 401) {
          if (currentView.type === 'link') {
            setCurrentView({ type: 'person', id });
            showToast('Link session expired', 'info');
          } else {
            router.push(`/p/${id}`);
          }
          return;
        }
        const errorData = await res.json().catch(() => ({}));
        console.error('Prayer update failed:', errorData);
        throw new Error(errorData.error || 'Failed to update prayer');
      }

      const data = await res.json();
      
      // Ensure the returned prayer has all required fields (migration safety)
      const updatedPrayer: Prayer = {
        ...data.prayer,
        category: data.prayer.category || 'immediate',
        notAnsweredNote: data.prayer.notAnsweredNote ?? null,
      };
      
      setPrayers(prev => prev.map(p => p.id === prayerId ? updatedPrayer : p));
      
      if (updates.answered === true) {
        showToast(updates.notAnsweredNote ? 'Prayer closed' : 'Prayer answered! ✓', 'success');
      } else if (updates.category) {
        showToast(`Moved to ${updates.category === 'immediate' ? 'Immediate' : 'Ongoing'}`, 'success');
      } else {
        showToast('Prayer updated', 'success');
      }
    } catch (error) {
      console.error('Error updating prayer:', error);
      showToast(error instanceof Error ? error.message : 'Failed to update prayer', 'error');
    }
  };

  const handleDeletePrayer = async (prayerId: string) => {
    const apiInfo = getCurrentApiInfo();
    if (!apiInfo.passcode) return;
    
    try {
      const bodyData: Record<string, unknown> = { 
        passcode: apiInfo.passcode 
      };
      // Include personId for link API calls
      if (apiInfo.isLink) {
        bodyData.personId = apiInfo.personId;
      }
      
      const res = await fetch(`${apiInfo.baseUrl}/prayers/${prayerId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData),
      });

      if (!res.ok) {
        if (res.status === 401) {
          if (currentView.type === 'link') {
            setCurrentView({ type: 'person', id });
            showToast('Link session expired', 'info');
          } else {
            router.push(`/p/${id}`);
          }
          return;
        }
        throw new Error('Failed to delete prayer');
      }

      setPrayers(prev => prev.filter(p => p.id !== prayerId));
      showToast('Prayer deleted', 'success');
    } catch (error) {
      console.error('Error deleting prayer:', error);
      showToast('Failed to delete prayer', 'error');
    }
  };

  const handleMarkPrayed = async (prayerId: string) => {
    await handleUpdatePrayer(prayerId, { lastPrayedAt: new Date().toISOString() });
    showToast('Marked as prayed ♡', 'success');
  };

  const handleLock = async () => {
    // Clear stored passcode
    sessionStorage.removeItem(`passcode_${id}`);
    setPasscode(null);
    showToast('Prayers locked', 'info');
    router.push('/');
  };

  const handleDeletePerson = async () => {
    if (!deleteConfirmPasscode) return;
    
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/people/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: deleteConfirmPasscode }),
      });

      if (!res.ok) {
        const data = await res.json();
        showToast(data.error || 'Failed to delete', 'error');
        return;
      }

      showToast('Person deleted', 'success');
      router.push('/');
    } catch (error) {
      console.error('Error deleting person:', error);
      showToast('Failed to delete', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Sort and categorize prayers
  const sortPrayers = (prayerList: Prayer[]) => {
    return [...prayerList].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  };

  const immediatePrayers = sortPrayers(prayers.filter(p => !p.answered && p.category === 'immediate'));
  const ongoingPrayers = sortPrayers(prayers.filter(p => !p.answered && p.category === 'ongoing'));
  const answeredPrayers = sortPrayers(prayers.filter(p => p.answered));
  const activePrayerCount = immediatePrayers.length + ongoingPrayers.length;

  if (isLoading || !person) {
    return (
      <div className="page-center">
        <div className="animate-pulse flex flex-col items-center" style={{ gap: 'var(--space-md)' }}>
          <div className="bg-[var(--border-light)] rounded-full" style={{ width: '72px', height: '72px' }} />
          <div className="bg-[var(--border-light)] rounded" style={{ width: '100px', height: '20px' }} />
        </div>
      </div>
    );
  }

  const PrayerColumn = ({ 
    title, 
    icon, 
    prayers: columnPrayers, 
    emptyMessage,
    accentColor,
  }: { 
    title: string; 
    icon: React.ReactNode;
    prayers: Prayer[]; 
    emptyMessage: string;
    accentColor: string;
  }) => (
    <div className="flex flex-col" style={{ minHeight: '300px' }}>
      {/* Column header */}
      <div 
        className="flex items-center sticky top-0 bg-[var(--bg-primary)] z-10"
        style={{ 
          gap: 'var(--space-sm)', 
          marginBottom: 'var(--space-md)',
          paddingBottom: 'var(--space-sm)',
          borderBottom: '2px solid var(--border-light)',
        }}
      >
        <div 
          className="rounded-full flex items-center justify-center"
          style={{ 
            width: '32px', 
            height: '32px', 
            background: accentColor,
          }}
        >
          {icon}
        </div>
        <div className="flex-1">
          <h3 
            className="font-serif font-semibold text-[var(--text-primary)]"
            style={{ fontSize: 'var(--text-base)' }}
          >
            {title}
          </h3>
        </div>
        <span 
          className="badge"
          style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}
        >
          {columnPrayers.length}
        </span>
      </div>

      {/* Prayers */}
      {columnPrayers.length === 0 ? (
        <div 
          className="flex-1 flex items-center justify-center text-center"
          style={{ padding: 'var(--space-lg)' }}
        >
          <p className="text-[var(--text-muted)]" style={{ fontSize: 'var(--text-sm)' }}>
            {emptyMessage}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          {columnPrayers.map((prayer) => (
            <PrayerCard
              key={prayer.id}
              prayer={prayer}
              onUpdate={(updates) => handleUpdatePrayer(prayer.id, updates)}
              onDelete={() => handleDeletePrayer(prayer.id)}
              onMarkPrayed={() => handleMarkPrayed(prayer.id)}
              compact
            />
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="page">
      <AppHeader
        showBack
        backHref="/"
        title={person.displayName}
        subtitle={`${activePrayerCount} active prayer${activePrayerCount !== 1 ? 's' : ''}`}
        actions={
          <div className="flex items-center" style={{ gap: 'var(--space-xs)' }}>
            {/* Lock button */}
            <button
              onClick={async () => {
                await fetch(`/api/people/${id}/lock`, { method: 'POST' });
                router.push(`/p/${id}`);
              }}
              className="btn btn-secondary btn-sm"
            >
              <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Lock
            </button>

            {/* Person menu */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowPersonMenu(!showPersonMenu)}
                className="icon-btn"
                aria-label="Person actions"
              >
                <svg style={{ width: '20px', height: '20px' }} fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                </svg>
              </button>

              {showPersonMenu && (
                <div 
                  className="absolute right-0 top-full card card-elevated animate-scale-in origin-top-right z-50"
                  style={{ marginTop: 'var(--space-xs)', width: '180px', padding: 'var(--space-xs)' }}
                >
                  <button
                    onClick={() => {
                      router.push(`/p/${id}/edit`);
                      setShowPersonMenu(false);
                    }}
                    className="w-full text-left flex items-center hover:bg-[var(--bg-secondary)] rounded-[var(--card-radius-sm)] transition-colors"
                    style={{ 
                      gap: 'var(--space-sm)', 
                      padding: 'var(--space-sm)',
                      fontSize: 'var(--text-sm)',
                    }}
                  >
                    <svg style={{ width: '16px', height: '16px' }} className="text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit {person.type}
                  </button>
                  <div className="divider" style={{ margin: 'var(--space-xs) 0' }} />
                  <button
                    onClick={() => {
                      setShowDeletePerson(true);
                      setShowPersonMenu(false);
                    }}
                    className="w-full text-left flex items-center text-[var(--error)] hover:bg-[var(--error-light)] rounded-[var(--card-radius-sm)] transition-colors"
                    style={{ 
                      gap: 'var(--space-sm)', 
                      padding: 'var(--space-sm)',
                      fontSize: 'var(--text-sm)',
                    }}
                  >
                    <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete {person.type}
                  </button>
                </div>
              )}
            </div>
          </div>
        }
      />

      <main className="flex-1">
        <div 
          className="container" 
          style={{ 
            maxWidth: '1200px', 
            paddingTop: 'var(--space-lg)', 
            paddingBottom: 'var(--space-3xl)' 
          }}
        >
          {/* Person header with profile switcher */}
          <section 
            className="card flex items-center animate-fade-in"
            style={{ 
              gap: 'var(--space-md)', 
              marginBottom: 'var(--space-lg)',
              position: 'relative',
              zIndex: showSwitcher ? 100 : 'auto',
            }}
          >
            <AvatarCircle
              name={currentView.type === 'link' 
                ? links.find(l => l.id === currentView.linkId)?.displayName || person.displayName 
                : person.displayName}
              initials={person.avatarInitials || undefined}
              color={person.avatarColor || undefined}
              imagePath={person.avatarPath || undefined}
              size="md"
              interactive={false}
            />
            <div className="flex-1 min-w-0">
              {/* Profile switcher dropdown */}
              <div className="relative" ref={switcherRef}>
                <button
                  onClick={() => links.length > 0 && setShowSwitcher(!showSwitcher)}
                  className={`font-serif font-semibold text-[var(--text-primary)] flex items-center transition-colors ${
                    links.length > 0 ? 'hover:text-[var(--accent-primary)] cursor-pointer' : ''
                  }`}
                  style={{ fontSize: 'var(--text-lg)', gap: 'var(--space-xs)' }}
                  disabled={links.length === 0}
                >
                  {currentView.type === 'link' 
                    ? links.find(l => l.id === currentView.linkId)?.displayName || 'Linked Prayers' 
                    : person.displayName}
                  {links.length > 0 && (
                    <svg 
                      style={{ width: '16px', height: '16px', transition: 'transform 0.2s' }} 
                      className={showSwitcher ? 'rotate-180' : ''}
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  )}
                </button>
                
                {showSwitcher && links.length > 0 && (
                  <div 
                    className="absolute left-0 top-full card card-elevated animate-scale-in origin-top-left"
                    style={{ marginTop: 'var(--space-xs)', width: '280px', padding: 'var(--space-xs)', zIndex: 9999 }}
                  >
                    {/* Personal prayers option */}
                    <button
                      onClick={() => {
                        setCurrentView({ type: 'person', id });
                        setShowSwitcher(false);
                      }}
                      className={`w-full text-left flex items-center rounded-[var(--card-radius-sm)] transition-colors ${
                        currentView.type === 'person' 
                          ? 'bg-[var(--accent-primary-light)] text-[var(--accent-primary)]' 
                          : 'hover:bg-[var(--bg-secondary)]'
                      }`}
                      style={{ gap: 'var(--space-sm)', padding: 'var(--space-sm)' }}
                    >
                      <AvatarCircle
                        name={person.displayName}
                        initials={person.avatarInitials || undefined}
                        color={person.avatarColor || undefined}
                        size="xs"
                        interactive={false}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-medium" style={{ fontSize: 'var(--text-sm)' }}>
                          {person.displayName}
                        </p>
                        <p className="text-[var(--text-muted)]" style={{ fontSize: 'var(--text-xs)' }}>
                          Personal prayers
                        </p>
                      </div>
                      {currentView.type === 'person' && (
                        <svg className="text-[var(--accent-primary)]" style={{ width: '16px', height: '16px' }} fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                    
                    {links.length > 0 && (
                      <div className="divider" style={{ margin: 'var(--space-xs) 0' }} />
                    )}
                    
                    {/* Linked prayers options */}
                    {links.map(link => {
                      const isActive = currentView.type === 'link' && currentView.linkId === link.id;
                      const otherPerson = link.person1.id === id ? link.person2 : link.person1;
                      
                      return (
                        <button
                          key={link.id}
                          onClick={() => {
                            if (isActive) {
                              setShowSwitcher(false);
                              return;
                            }
                            // Switch to link view - no passcode needed, uses person's passcode
                            handleSwitchToLink(link.id);
                          }}
                          className={`w-full text-left flex items-center rounded-[var(--card-radius-sm)] transition-colors ${
                            isActive
                              ? 'bg-[var(--accent-primary-light)] text-[var(--accent-primary)]' 
                              : 'hover:bg-[var(--bg-secondary)]'
                          }`}
                          style={{ gap: 'var(--space-sm)', padding: 'var(--space-sm)' }}
                        >
                          <div className="relative" style={{ width: '36px', height: '28px' }}>
                            <div 
                              className="absolute rounded-full border-2 border-[var(--surface-primary)]"
                              style={{ left: 0, top: 0, width: '28px', height: '28px', overflow: 'hidden', backgroundColor: link.person1.avatarColor || 'var(--bg-secondary)' }}
                            >
                              <div className="w-full h-full flex items-center justify-center text-white font-medium" style={{ fontSize: '10px' }}>
                                {link.person1.avatarInitials || '?'}
                              </div>
                            </div>
                            <div 
                              className="absolute rounded-full border-2 border-[var(--surface-primary)]"
                              style={{ left: '12px', top: 0, width: '28px', height: '28px', overflow: 'hidden', backgroundColor: link.person2.avatarColor || 'var(--bg-secondary)' }}
                            >
                              <div className="w-full h-full flex items-center justify-center text-white font-medium" style={{ fontSize: '10px' }}>
                                {link.person2.avatarInitials || '?'}
                              </div>
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="truncate font-medium" style={{ fontSize: 'var(--text-sm)' }}>
                              {link.displayName}
                            </p>
                            <p className="text-[var(--text-muted)]" style={{ fontSize: 'var(--text-xs)' }}>
                              Linked with {otherPerson.displayName}
                            </p>
                          </div>
                          {isActive ? (
                            <svg className="text-[var(--accent-primary)]" style={{ width: '16px', height: '16px' }} fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <svg className="text-[var(--text-muted)]" style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              
              <p 
                className="text-[var(--text-muted)] flex items-center"
                style={{ fontSize: 'var(--text-sm)', gap: '6px', marginTop: '2px' }}
              >
                {person.type === 'group' && (
                  <svg style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                )}
                {currentView.type === 'link' && (
                  <svg style={{ width: '14px', height: '14px' }} fill="currentColor" viewBox="0 0 24 24">
                    <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                )}
                {activePrayerCount} active • {answeredPrayers.length} answered
                {links.length > 0 && currentView.type === 'person' && (
                  <span className="text-[var(--accent-primary)]" style={{ marginLeft: 'var(--space-xs)' }}>
                    • {links.length} link{links.length !== 1 ? 's' : ''}
                  </span>
                )}
              </p>
            </div>
          </section>

          {/* Verse */}
          <section 
            className="animate-fade-in stagger-1"
            style={{ marginBottom: 'var(--space-lg)' }}
          >
            <VerseCard verseId={person.verseId} />
          </section>

          {/* Add prayer composer */}
          <section 
            className="animate-fade-in stagger-2"
            style={{ marginBottom: 'var(--space-xl)' }}
          >
            <AddPrayerComposer onAdd={handleAddPrayer} isLoading={isAddingPrayer} />
          </section>

          {/* 3-column prayer layout */}
          {prayers.length === 0 ? (
            <section 
              className="card text-center animate-fade-in stagger-3"
              style={{ padding: 'var(--space-2xl)' }}
            >
              <div 
                className="mx-auto bg-[var(--accent-primary-light)] rounded-full flex items-center justify-center"
                style={{ width: '64px', height: '64px', marginBottom: 'var(--space-md)' }}
              >
                <svg className="text-[var(--accent-primary)]" style={{ width: '32px', height: '32px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <h3 
                className="font-serif font-semibold text-[var(--text-primary)]"
                style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-xs)' }}
              >
                No prayers yet
              </h3>
              <p className="text-[var(--text-muted)]" style={{ fontSize: 'var(--text-base)' }}>
                Add your first prayer request above
              </p>
            </section>
          ) : (
            <section 
              className="animate-fade-in stagger-3"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: 'var(--space-xl)',
              }}
            >
              <PrayerColumn
                title="Immediate"
                icon={
                  <svg style={{ width: '16px', height: '16px' }} className="text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                }
                prayers={immediatePrayers}
                emptyMessage="No urgent prayers right now"
                accentColor="var(--accent-gold)"
              />

              <PrayerColumn
                title="Ongoing"
                icon={
                  <svg style={{ width: '16px', height: '16px' }} className="text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                }
                prayers={ongoingPrayers}
                emptyMessage="No long-term prayers"
                accentColor="var(--accent-primary)"
              />

              <PrayerColumn
                title="Answered"
                icon={
                  <svg style={{ width: '16px', height: '16px' }} className="text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                }
                prayers={answeredPrayers}
                emptyMessage="Answered prayers will appear here"
                accentColor="var(--success)"
              />
            </section>
          )}
        </div>
      </main>

      <LockTimerBanner personId={id} onLock={handleLock} />

      {/* Delete person modal */}
      {showDeletePerson && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          style={{ padding: 'var(--space-md)' }}
        >
          <div 
            className="card card-elevated w-full animate-scale-in"
            style={{ maxWidth: '400px' }}
          >
            <h2 
              className="font-serif font-semibold text-[var(--text-primary)]"
              style={{ fontSize: 'var(--text-xl)', marginBottom: 'var(--space-xs)' }}
            >
              Delete {person.displayName}?
            </h2>
            <p 
              className="text-[var(--text-secondary)]"
              style={{ marginBottom: 'var(--space-lg)', lineHeight: 'var(--leading-relaxed)' }}
            >
              This will permanently delete this {person.type} and all their prayer requests. This action cannot be undone.
            </p>

            <div className="form-group">
              <label htmlFor="deleteConfirm" className="label">Enter passcode to confirm</label>
              <input
                id="deleteConfirm"
                type="password"
                value={deleteConfirmPasscode}
                onChange={(e) => setDeleteConfirmPasscode(e.target.value)}
                placeholder="Passcode"
                className="input"
              />
            </div>

            <div className="flex" style={{ gap: 'var(--space-sm)' }}>
              <button
                onClick={() => {
                  setShowDeletePerson(false);
                  setDeleteConfirmPasscode('');
                }}
                className="btn btn-secondary flex-1"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDeletePerson}
                disabled={!deleteConfirmPasscode || isDeleting}
                className="btn btn-danger flex-1"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

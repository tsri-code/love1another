'use client';

import { useState, useEffect, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import { AppHeader } from '@/components/AppHeader';
import { AvatarCircle } from '@/components/AvatarCircle';
import { useToast } from '@/lib/toast';

// Extended color palette
const AVATAR_COLORS = [
  '#c75c5c', '#e57373', '#ff8a65', '#ffb74d', 
  '#ffd54f', '#fff176', '#dce775', '#aed581',
  '#81c784', '#4db6ac', '#4dd0e1', '#4fc3f7',
  '#64b5f6', '#7986cb', '#9575cd', '#ba68c8',
  '#f06292', '#a1887f', '#8b7355', '#b8860b',
  '#c9a959', '#7c9a6e', '#5a8a4a', '#6b8cae',
];

type EntityType = 'person' | 'group';

interface Person {
  id: string;
  displayName: string;
  type: EntityType;
  avatarPath: string | null;
  avatarInitials: string | null;
  avatarColor: string | null;
}

interface LinkInfo {
  id: string;
  displayName: string;
  person1: { id: string; displayName: string; avatarInitials: string | null; avatarColor: string | null; };
  person2: { id: string; displayName: string; avatarInitials: string | null; avatarColor: string | null; };
  prayerCount: number;
}

interface AvailablePerson {
  id: string;
  displayName: string;
  avatarInitials: string | null;
  avatarColor: string | null;
  avatarPath: string | null;
}

export default function EditPersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [person, setPerson] = useState<Person | null>(null);
  const [links, setLinks] = useState<LinkInfo[]>([]);
  const [displayName, setDisplayName] = useState('');
  const [type, setType] = useState<EntityType>('person');
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);
  const [avatarImage, setAvatarImage] = useState<string | null>(null);
  const [currentPasscode, setCurrentPasscode] = useState('');
  const [newPasscode, setNewPasscode] = useState('');
  const [confirmNewPasscode, setConfirmNewPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [customColor, setCustomColor] = useState('#6b8cae');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // For creating new links
  const [showCreateLink, setShowCreateLink] = useState(false);
  const [availablePeople, setAvailablePeople] = useState<AvailablePerson[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);
  const [person2Passcode, setPerson2Passcode] = useState('');
  const [linkSearch, setLinkSearch] = useState('');
  const [isCreatingLink, setIsCreatingLink] = useState(false);
  
  const router = useRouter();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const colorPickerRef = useRef<HTMLDivElement>(null);

  // Close color picker on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
        setShowColorPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load person data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/people/${id}`);
        if (!res.ok) throw new Error('Failed to load person');
        const data = await res.json();
        
        setPerson(data.person);
        setDisplayName(data.person.displayName);
        setType(data.person.type);
        setAvatarColor(data.person.avatarColor || AVATAR_COLORS[0]);
        setAvatarImage(data.person.avatarPath);
        
        // Set links
        if (data.links) {
          setLinks(data.links);
        }
      } catch (error) {
        console.error('Error loading person:', error);
        showToast('Failed to load person', 'error');
        router.push('/');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [id, router, showToast]);

  // Load available people for linking when modal opens
  useEffect(() => {
    if (showCreateLink) {
      fetch('/api/people/available')
        .then(res => res.json())
        .then(data => {
          // Filter out current person
          const filtered = (data.people || []).filter((p: AvailablePerson) => p.id !== id);
          setAvailablePeople(filtered);
        })
        .catch(() => {
          showToast('Failed to load people', 'error');
        });
    }
  }, [showCreateLink, id, showToast]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showToast('Image must be less than 5MB', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setAvatarImage(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const initials = displayName.trim().substring(0, 2).toUpperCase() || '?';

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!displayName.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!currentPasscode) {
      newErrors.currentPasscode = 'Current passcode is required to save changes';
    }

    if (newPasscode && newPasscode.length < 4) {
      newErrors.newPasscode = 'New passcode must be at least 4 characters';
    }

    if (newPasscode && newPasscode !== confirmNewPasscode) {
      newErrors.confirmNewPasscode = 'Passcodes do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSaving(true);

    try {
      const res = await fetch(`/api/people/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: displayName.trim(),
          type,
          avatarInitials: initials,
          avatarColor,
          avatarPath: avatarImage,
          currentPasscode,
          newPasscode: newPasscode || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        if (res.status === 401) {
          setErrors(prev => ({ ...prev, currentPasscode: 'Incorrect passcode' }));
          return;
        }
        throw new Error(data.error || 'Failed to save');
      }

      showToast('Changes saved', 'success');
      router.push(`/p/${id}/prayers`);
    } catch (error) {
      console.error('Error saving:', error);
      showToast(error instanceof Error ? error.message : 'Failed to save', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateLink = async () => {
    if (!selectedPerson || !person2Passcode) return;
    
    // Get person1's passcode from sessionStorage
    const person1Passcode = sessionStorage.getItem(`passcode_${id}`);
    if (!person1Passcode) {
      showToast('Please unlock this profile first to create a link', 'error');
      return;
    }

    setIsCreatingLink(true);

    try {
      const res = await fetch('/api/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          person1Id: id,
          person2Id: selectedPerson,
          person1Passcode,
          person2Passcode,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create link');
      }

      showToast('Link created successfully! You can now switch to it from the prayers page.', 'success');
      setShowCreateLink(false);
      setSelectedPerson(null);
      setPerson2Passcode('');
      setLinkSearch('');
      
      // Refresh data to show new link
      const refreshRes = await fetch(`/api/people/${id}`);
      if (refreshRes.ok) {
        const data = await refreshRes.json();
        if (data.links) setLinks(data.links);
      }
    } catch (error) {
      console.error('Error creating link:', error);
      showToast(error instanceof Error ? error.message : 'Failed to create link', 'error');
    } finally {
      setIsCreatingLink(false);
    }
  };

  // Filter available people by search
  const filteredPeople = availablePeople.filter(p => 
    p.displayName.toLowerCase().includes(linkSearch.toLowerCase())
  );

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

  return (
    <div className="page">
      <AppHeader 
        showBack 
        backHref={`/p/${id}/prayers`} 
        title={`Edit ${person.displayName}`}
      />

      <main className="flex-1">
        <div className="container" style={{ maxWidth: '480px', paddingTop: 'var(--space-xl)', paddingBottom: 'var(--space-3xl)' }}>
          <form onSubmit={handleSubmit} className="card card-elevated animate-fade-in">
            
            {/* Avatar preview */}
            <div 
              className="flex flex-col items-center"
              style={{ marginBottom: 'var(--space-lg)', gap: 'var(--space-md)' }}
            >
              <div className="relative">
                <div
                  className="rounded-full flex items-center justify-center font-serif font-semibold text-white transition-all duration-300 overflow-hidden"
                  style={{ 
                    width: '100px',
                    height: '100px',
                    fontSize: '32px',
                    backgroundColor: avatarImage ? 'transparent' : avatarColor,
                    boxShadow: 'var(--shadow-md)',
                  }}
                >
                  {avatarImage ? (
                    <img src={avatarImage} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    initials
                  )}
                </div>
                
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-1 -right-1 rounded-full bg-[var(--surface-primary)] border-2 border-[var(--bg-primary)] shadow-md hover:bg-[var(--bg-secondary)] transition-colors"
                  style={{ width: '32px', height: '32px' }}
                  title="Upload photo"
                >
                  <svg className="text-[var(--text-secondary)] mx-auto" style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </div>
              
              {avatarImage && (
                <button
                  type="button"
                  onClick={() => setAvatarImage(null)}
                  className="text-[var(--text-muted)] hover:text-[var(--error)] transition-colors"
                  style={{ fontSize: 'var(--text-sm)' }}
                >
                  Remove photo
                </button>
              )}
            </div>

            {/* Name */}
            <div className="form-group">
              <label htmlFor="name" className="label">Name</label>
              <input
                id="name"
                type="text"
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  if (errors.name) setErrors(prev => ({ ...prev, name: '' }));
                }}
                className={`input ${errors.name ? 'input-error' : ''}`}
                maxLength={50}
              />
              {errors.name && <p className="form-error">{errors.name}</p>}
            </div>

            {/* Color picker */}
            {!avatarImage && (
              <div className="form-group" ref={colorPickerRef}>
                <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-sm)' }}>
                  <label className="label" style={{ marginBottom: 0 }}>Avatar Color</label>
                  <button
                    type="button"
                    onClick={() => setShowColorPicker(!showColorPicker)}
                    className="text-[var(--accent-primary)] hover:underline"
                    style={{ fontSize: 'var(--text-sm)' }}
                  >
                    {showColorPicker ? 'Close' : 'Custom color'}
                  </button>
                </div>
                
                <div className="grid" style={{ gridTemplateColumns: 'repeat(8, 1fr)', gap: 'var(--space-xs)' }}>
                  {AVATAR_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setAvatarColor(color)}
                      className={`rounded-full transition-transform hover:scale-110 ${
                        avatarColor === color ? 'ring-2 ring-offset-2 ring-[var(--text-primary)]' : ''
                      }`}
                      style={{ width: '100%', aspectRatio: '1', backgroundColor: color }}
                    />
                  ))}
                </div>

                {showColorPicker && (
                  <div className="bg-[var(--bg-secondary)] rounded-[var(--radius-md)]" style={{ marginTop: 'var(--space-md)', padding: 'var(--space-md)' }}>
                    <div className="flex items-center" style={{ gap: 'var(--space-md)' }}>
                      <input
                        type="color"
                        value={customColor}
                        onChange={(e) => setCustomColor(e.target.value)}
                        className="rounded cursor-pointer"
                        style={{ width: '60px', height: '40px', border: 'none' }}
                      />
                      <input
                        type="text"
                        value={customColor}
                        onChange={(e) => setCustomColor(e.target.value)}
                        className="input flex-1"
                        maxLength={7}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setAvatarColor(customColor);
                          setShowColorPicker(false);
                        }}
                        className="btn btn-primary btn-sm"
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="divider" />

            {/* Passcode section */}
            <div>
              <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-md)' }}>
                <h3 className="font-medium text-[var(--text-primary)]" style={{ fontSize: 'var(--text-sm)' }}>
                  Security
                </h3>
                <label className="flex items-center text-[var(--text-muted)] cursor-pointer" style={{ gap: 'var(--space-xs)', fontSize: 'var(--text-sm)' }}>
                  <input
                    type="checkbox"
                    checked={showPasscode}
                    onChange={(e) => setShowPasscode(e.target.checked)}
                    className="rounded border-[var(--border-medium)]"
                    style={{ width: '16px', height: '16px' }}
                  />
                  Show passcodes
                </label>
              </div>

              <div className="form-group">
                <label htmlFor="currentPasscode" className="label">Current Passcode</label>
                <input
                  id="currentPasscode"
                  type={showPasscode ? 'text' : 'password'}
                  value={currentPasscode}
                  onChange={(e) => {
                    setCurrentPasscode(e.target.value);
                    if (errors.currentPasscode) setErrors(prev => ({ ...prev, currentPasscode: '' }));
                  }}
                  placeholder="Required to save changes"
                  className={`input ${errors.currentPasscode ? 'input-error' : ''}`}
                />
                {errors.currentPasscode && <p className="form-error">{errors.currentPasscode}</p>}
              </div>

              <div className="form-group">
                <label htmlFor="newPasscode" className="label">New Passcode (optional)</label>
                <input
                  id="newPasscode"
                  type={showPasscode ? 'text' : 'password'}
                  value={newPasscode}
                  onChange={(e) => {
                    setNewPasscode(e.target.value);
                    if (errors.newPasscode) setErrors(prev => ({ ...prev, newPasscode: '' }));
                  }}
                  placeholder="Leave blank to keep current"
                  className={`input ${errors.newPasscode ? 'input-error' : ''}`}
                />
                {errors.newPasscode && <p className="form-error">{errors.newPasscode}</p>}
              </div>

              {newPasscode && (
                <div className="form-group">
                  <label htmlFor="confirmNewPasscode" className="label">Confirm New Passcode</label>
                  <input
                    id="confirmNewPasscode"
                    type={showPasscode ? 'text' : 'password'}
                    value={confirmNewPasscode}
                    onChange={(e) => {
                      setConfirmNewPasscode(e.target.value);
                      if (errors.confirmNewPasscode) setErrors(prev => ({ ...prev, confirmNewPasscode: '' }));
                    }}
                    className={`input ${errors.confirmNewPasscode ? 'input-error' : ''}`}
                  />
                  {errors.confirmNewPasscode && <p className="form-error">{errors.confirmNewPasscode}</p>}
                </div>
              )}
            </div>

            <div className="divider" />

            {/* Actions */}
            <div className="flex flex-col-reverse sm:flex-row" style={{ gap: 'var(--space-sm)' }}>
              <button
                type="button"
                onClick={() => router.back()}
                className="btn btn-secondary btn-full sm:flex-1"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="btn btn-primary btn-full sm:flex-1"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>

          {/* Linked Prayers Section */}
          {person.type === 'person' && (
            <div className="card card-elevated animate-fade-in" style={{ marginTop: 'var(--space-xl)' }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-md)' }}>
                <h3 className="font-serif font-semibold text-[var(--text-primary)]" style={{ fontSize: 'var(--text-lg)' }}>
                  Linked Prayers
                </h3>
                <button
                  onClick={() => setShowCreateLink(true)}
                  className="btn btn-primary btn-sm"
                >
                  <svg style={{ width: '16px', height: '16px' }} fill="currentColor" viewBox="0 0 24 24">
                    <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  Create Link
                </button>
              </div>
              
              <p className="text-[var(--text-muted)]" style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--space-md)' }}>
                Link {person.displayName} with another person to share a prayer list together.
              </p>

              {links.length === 0 ? (
                <div 
                  className="text-center bg-[var(--bg-secondary)] rounded-[var(--radius-md)]"
                  style={{ padding: 'var(--space-lg)' }}
                >
                  <svg 
                    className="mx-auto text-[var(--text-muted)]" 
                    style={{ width: '32px', height: '32px', marginBottom: 'var(--space-sm)' }} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  <p className="text-[var(--text-muted)]" style={{ fontSize: 'var(--text-sm)' }}>
                    No linked prayers yet
                  </p>
                </div>
              ) : (
                <div className="flex flex-col" style={{ gap: 'var(--space-sm)' }}>
                  {links.map(link => {
                    const otherPerson = link.person1.id === id ? link.person2 : link.person1;
                    return (
                      <div 
                        key={link.id}
                        className="flex items-center bg-[var(--bg-secondary)] rounded-[var(--radius-md)]"
                        style={{ padding: 'var(--space-md)', gap: 'var(--space-md)' }}
                      >
                        <AvatarCircle
                          name={otherPerson.displayName}
                          initials={otherPerson.avatarInitials || undefined}
                          color={otherPerson.avatarColor || undefined}
                          size="sm"
                          interactive={false}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-[var(--text-primary)] truncate" style={{ fontSize: 'var(--text-base)' }}>
                            {link.displayName}
                          </p>
                          <p className="text-[var(--text-muted)]" style={{ fontSize: 'var(--text-xs)' }}>
                            {link.prayerCount} prayer{link.prayerCount !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <svg className="text-[var(--accent-primary)]" style={{ width: '16px', height: '16px' }} fill="currentColor" viewBox="0 0 24 24">
                          <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Create Link Modal */}
      {showCreateLink && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          style={{ padding: 'var(--space-md)' }}
        >
          <div 
            className="card card-elevated w-full animate-scale-in"
            style={{ maxWidth: '480px', maxHeight: '90vh', overflow: 'auto' }}
          >
            <div className="flex items-center" style={{ gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
              <div className="rounded-full bg-[var(--accent-primary-light)] flex items-center justify-center" style={{ width: '48px', height: '48px' }}>
                <svg className="text-[var(--accent-primary)]" style={{ width: '24px', height: '24px' }} fill="currentColor" viewBox="0 0 24 24">
                  <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <div>
                <h2 className="font-serif font-semibold text-[var(--text-primary)]" style={{ fontSize: 'var(--text-xl)' }}>
                  Create Link
                </h2>
                <p className="text-[var(--text-muted)]" style={{ fontSize: 'var(--text-sm)' }}>
                  Link {person.displayName} with another person
                </p>
              </div>
            </div>

            {/* Current person (auto-selected) */}
            <div style={{ marginBottom: 'var(--space-lg)' }}>
              <label className="label">First Person</label>
              <div 
                className="flex items-center bg-[var(--accent-primary-light)] border-2 border-[var(--accent-primary)] rounded-[var(--radius-md)]"
                style={{ padding: 'var(--space-md)', gap: 'var(--space-md)' }}
              >
                <AvatarCircle
                  name={person.displayName}
                  initials={person.avatarInitials || undefined}
                  color={person.avatarColor || undefined}
                  size="sm"
                  interactive={false}
                />
                <p className="font-medium text-[var(--text-primary)]">{person.displayName}</p>
                <svg className="ml-auto text-[var(--accent-primary)]" style={{ width: '16px', height: '16px' }} fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            </div>

            {/* Select second person */}
            <div style={{ marginBottom: 'var(--space-lg)' }}>
              <label className="label">Select Second Person</label>
              
              {/* Search */}
              <div className="relative" style={{ marginBottom: 'var(--space-sm)' }}>
                <svg 
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" 
                  style={{ width: '16px', height: '16px' }} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={linkSearch}
                  onChange={(e) => setLinkSearch(e.target.value)}
                  placeholder="Search people..."
                  className="input"
                  style={{ paddingLeft: '40px' }}
                />
              </div>
              
              {/* People list with scroll */}
              <div 
                className="border border-[var(--border-light)] rounded-[var(--radius-md)] overflow-auto"
                style={{ maxHeight: '200px' }}
              >
                {filteredPeople.length === 0 ? (
                  <div className="text-center text-[var(--text-muted)]" style={{ padding: 'var(--space-lg)' }}>
                    {availablePeople.length === 0 ? 'No people available to link' : 'No matching people'}
                  </div>
                ) : (
                  filteredPeople.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedPerson(p.id)}
                      className={`w-full flex items-center transition-colors ${
                        selectedPerson === p.id 
                          ? 'bg-[var(--accent-primary-light)]' 
                          : 'hover:bg-[var(--bg-secondary)]'
                      }`}
                      style={{ padding: 'var(--space-sm) var(--space-md)', gap: 'var(--space-md)' }}
                    >
                      <AvatarCircle
                        name={p.displayName}
                        initials={p.avatarInitials || undefined}
                        color={p.avatarColor || undefined}
                        size="xs"
                        interactive={false}
                      />
                      <p className="font-medium text-[var(--text-primary)] flex-1 text-left">{p.displayName}</p>
                      {selectedPerson === p.id && (
                        <svg className="text-[var(--accent-primary)]" style={{ width: '16px', height: '16px' }} fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Second person's passcode for verification */}
            <div className="form-group">
              <label htmlFor="person2Passcode" className="label">
                {availablePeople.find(p => p.id === selectedPerson)?.displayName || 'Their'}&apos;s Passcode
              </label>
              <input
                id="person2Passcode"
                type="password"
                value={person2Passcode}
                onChange={(e) => setPerson2Passcode(e.target.value)}
                placeholder="Enter their passcode to verify access"
                className="input"
              />
              <p className="form-hint">
                Enter their passcode to confirm you have access to both profiles. 
                No new passcode is needed - you&apos;ll access the linked prayers using your existing passcodes.
              </p>
            </div>

            <div className="flex" style={{ gap: 'var(--space-sm)', marginTop: 'var(--space-lg)' }}>
              <button
                type="button"
                onClick={() => {
                  setShowCreateLink(false);
                  setSelectedPerson(null);
                  setPerson2Passcode('');
                  setLinkSearch('');
                }}
                className="btn btn-secondary flex-1"
                disabled={isCreatingLink}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateLink}
                disabled={!selectedPerson || !person2Passcode || isCreatingLink}
                className="btn btn-primary flex-1"
              >
                {isCreatingLink ? 'Creating...' : 'Create Link'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

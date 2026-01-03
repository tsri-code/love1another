'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AvatarCircle } from '@/components/AvatarCircle';
import { AppHeader } from '@/components/AppHeader';
import { VerseCard } from '@/components/VerseCard';
import { formatDistanceToNow } from 'date-fns';

interface Person {
  id: string;
  displayName: string;
  type: 'person' | 'group';
  avatarPath: string | null;
  avatarInitials: string | null;
  avatarColor: string | null;
  verseId: number;
  prayerCount: number;
  lastPrayedAt: string | null;
}

export default function HomePage() {
  const [people, setPeople] = useState<Person[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchPeople();
  }, []);

  const fetchPeople = async () => {
    try {
      const res = await fetch('/api/people');
      const data = await res.json();
      setPeople(data.people || []);
    } catch (error) {
      console.error('Error fetching people:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePersonClick = (id: string) => {
    router.push(`/p/${id}`);
  };

  const handleAddPerson = () => {
    router.push('/add');
  };

  return (
    <div className="page">
      <AppHeader />

      <main className="flex-1">
        <div className="container">
          {/* === Header Section === */}
          <section 
            className="text-center animate-fade-in"
            style={{ paddingTop: 'var(--space-2xl)', paddingBottom: 'var(--space-lg)' }}
          >
            <h1 
              className="font-serif font-semibold text-[var(--text-primary)]"
              style={{ fontSize: 'var(--text-2xl)', marginBottom: 'var(--space-xs)' }}
            >
              Love One Another
          </h1>
            <p 
              className="font-serif italic text-[var(--text-muted)]"
              style={{ fontSize: 'var(--text-base)', lineHeight: 'var(--leading-relaxed)' }}
            >
              Bear one another's burdens
            </p>
          </section>

          {isLoading ? (
            <div 
              className="flex items-center justify-center"
              style={{ padding: 'var(--space-3xl) 0' }}
            >
              <div className="animate-pulse flex flex-col items-center" style={{ gap: 'var(--space-md)' }}>
                <div 
                  className="bg-[var(--border-light)] rounded-full"
                  style={{ width: '88px', height: '88px' }}
                />
                <div 
                  className="bg-[var(--border-light)] rounded"
                  style={{ width: '80px', height: '16px' }}
                />
              </div>
            </div>
          ) : people.length === 0 ? (
            /* === Empty State === */
            <>
              {/* Verse Section - Anchors the purpose */}
              <section 
                className="animate-fade-in stagger-1"
                style={{ paddingBottom: 'var(--space-xl)' }}
              >
                <VerseCard verseId={1} />
              </section>

              {/* Empty State Card */}
              <section 
                className="animate-fade-in stagger-2"
                style={{ paddingBottom: 'var(--space-3xl)' }}
              >
                <div className="card card-elevated text-center" style={{ padding: 'var(--space-2xl)' }}>
                  {/* Icon */}
                  <div 
                    className="mx-auto bg-[var(--accent-primary-light)] rounded-full flex items-center justify-center"
                    style={{ width: '72px', height: '72px', marginBottom: 'var(--space-lg)' }}
                  >
                    <svg className="text-[var(--accent-primary)]" style={{ width: '36px', height: '36px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>

                  <h2 
                    className="font-serif font-semibold text-[var(--text-primary)]"
                    style={{ fontSize: 'var(--text-xl)', marginBottom: 'var(--space-sm)' }}
                  >
                    Start Your Prayer List
                  </h2>
                  
                  <p 
                    className="text-[var(--text-secondary)] mx-auto"
                    style={{ 
                      maxWidth: '360px', 
                      marginBottom: 'var(--space-xl)',
                      lineHeight: 'var(--leading-relaxed)'
                    }}
                  >
                    Add people or groups you'd like to pray for. Each has their own private prayer list, protected by a passcode.
                  </p>

                  <button
                    onClick={handleAddPerson}
                    className="btn btn-primary btn-lg"
                  >
                    <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Your First Person
                  </button>
                </div>
              </section>
            </>
          ) : (
            /* === People Grid === */
            <>
              {/* Verse Section - Anchors the purpose */}
              <section 
                className="animate-fade-in stagger-1"
                style={{ paddingBottom: 'var(--space-xl)' }}
              >
                <VerseCard verseId={(people[0]?.verseId || 0) + 1 || 5} />
              </section>

              {/* People Grid */}
              <section 
                className="animate-fade-in stagger-2"
                style={{ paddingBottom: 'var(--space-3xl)' }}
              >
                <div 
                  className="grid"
                  style={{
                    gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                    gap: 'var(--space-lg)',
                  }}
                >
                  {people.map((person, index) => (
                    <div
                      key={person.id}
                      className="flex flex-col items-center text-center animate-fade-in"
                      style={{ 
                        animationDelay: `${(index + 2) * 50}ms`, 
                        opacity: 0, 
                        animationFillMode: 'forwards' 
                      }}
                    >
                      <AvatarCircle
                        name={person.displayName}
                        initials={person.avatarInitials || undefined}
                        color={person.avatarColor || undefined}
                        imagePath={person.avatarPath || undefined}
                        size="lg"
                        onClick={() => handlePersonClick(person.id)}
                      />
                      <div style={{ marginTop: 'var(--space-sm)' }}>
                        <p 
                          className="font-medium text-[var(--text-primary)] truncate"
                          style={{ maxWidth: '120px', fontSize: 'var(--text-base)' }}
                        >
                          {person.displayName}
                        </p>
                        <p 
                          className="text-[var(--text-muted)] flex items-center justify-center"
                          style={{ fontSize: 'var(--text-sm)', marginTop: '4px', gap: '4px' }}
                        >
                          {person.type === 'group' && (
                            <svg style={{ width: '12px', height: '12px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                          )}
                          {person.prayerCount} prayer{person.prayerCount !== 1 ? 's' : ''}
                        </p>
                        {person.lastPrayedAt && (
                          <p 
                            className="text-[var(--success)]"
                            style={{ fontSize: 'var(--text-xs)', marginTop: '2px' }}
                          >
                            Prayed {formatDistanceToNow(new Date(person.lastPrayedAt), { addSuffix: true })}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Add Person Tile - Primary affordance */}
                  <div
                    className="flex flex-col items-center text-center animate-fade-in"
                    style={{ 
                      animationDelay: `${(people.length + 2) * 50}ms`, 
                      opacity: 0, 
                      animationFillMode: 'forwards' 
                    }}
                  >
                    <button
                      onClick={handleAddPerson}
                      className="rounded-full flex items-center justify-center transition-all group"
                      style={{
                        width: '88px',
                        height: '88px',
                        background: 'var(--surface-accent)',
                        border: '2px solid var(--accent-primary)',
                        borderStyle: 'solid',
                      }}
                      aria-label="Add person or group"
                    >
                      <svg 
                        className="text-[var(--accent-primary)] transition-transform group-hover:scale-110" 
                        style={{ width: '32px', height: '32px' }} 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                    <div style={{ marginTop: 'var(--space-sm)' }}>
                      <p 
                        className="font-medium text-[var(--accent-primary)]"
                        style={{ fontSize: 'var(--text-base)' }}
                      >
                        Add Person
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

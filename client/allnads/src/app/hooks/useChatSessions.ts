import { useState, useEffect, useRef } from 'react';
import { ChatSession } from '../types/chat';
import { v4 as uuidv4 } from 'uuid';

// Create initial session
const createInitialSession = (): ChatSession => ({
  id: uuidv4(),
  title: 'New Chat',
  messages: [],
  lastActivity: new Date(),
});

export function useChatSessions(baseStorageKey: string, userId?: string | null) {
  // Create a unique storage key using the user ID
  const storageKey = userId ? `${baseStorageKey}_${userId}` : baseStorageKey;
  // The active session ID storage key should also be user-specific
  const activeSessionIdKey = userId ? `allnads_active_session_id_${userId}` : 'allnads_active_session_id';
  
  // Session management
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  
  // Use ref to track the current active session ID, solving closure issues
  const activeSessionIdRef = useRef<string>('');
  
  // Add a reference to mark if initial loading is complete
  const initialLoadCompleted = useRef<boolean>(false);

  // Load sessions from local storage
  useEffect(() => {
    // Reset initial load marker when user ID changes
    initialLoadCompleted.current = false;
    
    // Delayed loading to ensure component is fully mounted
    const timer = setTimeout(() => {
      console.log('Starting delayed session loading...');
      loadSessions();
    }, 100);
    
    const loadSessions = () => {
      try {
        console.log(`Attempting to load sessions from local storage, User ID: ${userId || 'Not logged in'}, Storage key: ${storageKey}`);
        const savedSessions = localStorage.getItem(storageKey);
        console.log('Raw data read from localStorage:', savedSessions);
        
        // First check if sessionId and activeSessionId markers already exist in localStorage
        const lastActiveId = localStorage.getItem(activeSessionIdKey);
        if (lastActiveId) {
          console.log('Found last active session ID:', lastActiveId);
        }
        
        if (savedSessions && savedSessions.length > 2) {  // Ensure it's not just "[]"
          let parsedSessions;
          try {
            parsedSessions = JSON.parse(savedSessions) as ChatSession[];
            
            // Verify if the parsed data is an array
            if (!Array.isArray(parsedSessions)) {
              console.error('Parsed data is not an array:', parsedSessions);
              throw new Error('Data format error: Not an array');
            }
            
            console.log('Parsed session data:', parsedSessions);
          } catch (parseError) {
            console.error('JSON parsing error:', parseError);
            throw new Error('Unable to parse session data');
          }
          
          // If saved data is an empty array, create a new session
          if (parsedSessions.length === 0) {
            console.log('Saved data is an empty array, creating new session');
            const newSession = createInitialSession();
            
            // Use functional update to ensure state is updated immediately
            setSessions(() => {
              initialLoadCompleted.current = true; // Mark initial loading as complete
              return [newSession];
            });
            
            setActiveSessionId(newSession.id);
            
            // Save current active session ID
            localStorage.setItem(activeSessionIdKey, newSession.id);
            return;
          }
          
          // Verify the integrity of each session object
          const validSessions = parsedSessions.filter(session => {
            if (!session || !session.id || !session.title || !Array.isArray(session.messages)) {
              console.error('Found invalid session:', session);
              return false;
            }
            return true;
          });
          
          if (validSessions.length === 0) {
            console.log('No valid session data, creating new session');
            const newSession = createInitialSession();
            
            // Use functional update to ensure state is updated immediately
            setSessions(() => {
              initialLoadCompleted.current = true; // Mark initial loading as complete
              return [newSession];
            });
            
            setActiveSessionId(newSession.id);
            
            // Save current active session ID
            localStorage.setItem(activeSessionIdKey, newSession.id);
            return;
          }
          
          // Ensure date objects are correctly restored
          const processedSessions = validSessions.map(session => ({
            ...session,
            lastActivity: new Date(session.lastActivity),
            messages: session.messages.map(msg => ({
              ...msg,
              timestamp: new Date(msg.timestamp)
            }))
          }));
          
          console.log('Processed session data:', processedSessions);
          
          // Use functional update to ensure state is updated immediately
          setSessions(() => {
            console.log('Setting session state, session count:', processedSessions.length);
            initialLoadCompleted.current = true; // Mark initial loading as complete
            return processedSessions;
          });
          
          // Set the most recently active session as the current session
          if (processedSessions.length > 0) {
            // Sort by most recent activity time
            const sortedSessions = [...processedSessions].sort(
              (a, b) => b.lastActivity.getTime() - a.lastActivity.getTime()
            );
            const newActiveId = lastActiveId && processedSessions.some(s => s.id === lastActiveId) 
              ? lastActiveId 
              : sortedSessions[0].id;
              
            setActiveSessionId(newActiveId);
            console.log('Setting active session ID:', newActiveId);
            
            // Save current active session ID
            localStorage.setItem(activeSessionIdKey, newActiveId);
          }
        } else {
          // No saved sessions or just an empty array, create a new session
          console.log('No valid session data in localStorage, creating new session');
          const newSession = createInitialSession();
          
          // Use functional update to ensure state is updated immediately
          setSessions(() => {
            initialLoadCompleted.current = true; // Mark initial loading as complete
            return [newSession];
          });
          
          setActiveSessionId(newSession.id);
          
          // Save current active session ID
          localStorage.setItem(activeSessionIdKey, newSession.id);
        }
      } catch (error) {
        console.error('Error loading sessions:', error);
        // Create a new session when an error occurs
        const newSession = createInitialSession();
        
        // Use functional update to ensure state is updated immediately
        setSessions(() => {
          initialLoadCompleted.current = true; // Mark initial loading as complete even for error handling
          return [newSession];
        });
        
        setActiveSessionId(newSession.id);
        
        // Save current active session ID
        localStorage.setItem(activeSessionIdKey, newSession.id);
      }
    };

    // Clean up timer
    return () => clearTimeout(timer);
  }, [storageKey, activeSessionIdKey, userId]);

  // Save sessions to local storage
  useEffect(() => {
    // If initial loading is not complete, don't save
    if (!initialLoadCompleted.current) {
      console.log('Initial loading not completed, skipping save to localStorage');
      return;
    }
    
    try {
      // Check sessions length again
      console.log(`Saving sessions to local storage, User ID: ${userId || 'Not logged in'}, Current session count:`, sessions.length, 'Session details:', JSON.stringify(sessions, (key, value) => {
        // Shorten message content for easier log reading
        if (key === 'content' && typeof value === 'string' && value.length > 30) {
          return value.substring(0, 30) + '...';
        }
        return value;
      }, 2).substring(0, 300) + '...');
      
      if (sessions.length === 0) {
        console.log('Warning: Attempting to save empty session array. This may indicate state was not properly updated.');
        // Verify if we should really save an empty array, or if this is an async state issue
        if (localStorage.getItem(storageKey) && localStorage.getItem(storageKey) !== '[]') {
          console.log('Data already exists in localStorage but current state is empty, skipping save to prevent data loss');
          return;
        }
        console.log('Saving empty session array to localStorage');
        localStorage.setItem(storageKey, '[]');
        return;
      }
      
      // Always save to local storage regardless of whether there are sessions
      // This way when the user deletes all sessions, an empty array is saved, preventing old data from reappearing after refresh
      const sessionsToSave = sessions.map(session => {
        // Verify session structure integrity before saving
        if (!session || !session.id) {
          console.error('Found invalid session object:', session);
          return null;
        }
        
        return {
          ...session,
          // Keep lastActivity and message timestamps as strings to avoid serialization issues
          lastActivity: session.lastActivity.toISOString(),
          messages: session.messages.map(msg => ({
            ...msg,
            timestamp: msg.timestamp.toISOString()
          }))
        };
      }).filter(Boolean); // Filter out invalid sessions
      
      console.log('Sessions data about to be saved:', sessionsToSave);
      const jsonData = JSON.stringify(sessionsToSave);
      console.log('Length of JSON data being saved:', jsonData.length);
      console.log('JSON data being saved:', jsonData.substring(0, 100) + (jsonData.length > 100 ? '...' : ''));
      
      localStorage.setItem(storageKey, jsonData);
      
      // Verify save
      const savedData = localStorage.getItem(storageKey);
      console.log('Verifying save success:', !!savedData, 'Data length:', savedData?.length);
    } catch (error) {
      console.error('Failed to save sessions to local storage:', error);
    }
  }, [sessions, storageKey, userId]);

  // Get current active session
  const activeSession = sessions.find(session => session.id === activeSessionId) || 
    (sessions.length > 0 ? sessions[0] : createInitialSession());

  // When activeSessionId is empty but sessions is not, automatically set activeSessionId to the first session
  useEffect(() => {
    if (!activeSessionId && sessions.length > 0) {
      console.log('Automatically setting activeSessionId to first session:', sessions[0].id);
      setActiveSessionId(sessions[0].id);
    }
  }, [activeSessionId, sessions]);

  // Update ref when activeSessionId changes
  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
    console.log(`activeSessionId updated to: ${activeSessionId}, ref updated to: ${activeSessionIdRef.current}`);
    
    // Also update the record in localStorage when activeSessionId changes
    if (activeSessionId) {
      localStorage.setItem(activeSessionIdKey, activeSessionId);
      console.log('Updated active session ID in localStorage:', activeSessionId);
    }
  }, [activeSessionId, activeSessionIdKey]);

  // Create new session
  const createNewSession = (isMobile: boolean = false, chatServiceRef: any = null, isNftInfoSet: boolean = false) => {
    const newSession = createInitialSession();
    console.log(`Creating new session: ID=${newSession.id}, Initial title="${newSession.title}"`);
    
    // Set the session ID in the chat service before updating state
    if (chatServiceRef) {
      chatServiceRef.setSessionId(newSession.id);
      
      // Store the session ID in the ref for immediate access
      activeSessionIdRef.current = newSession.id;
      
      // Update localStorage with the new active session ID
      localStorage.setItem(activeSessionIdKey, newSession.id);
      
      // If NFT info is already set, connect to WebSocket directly
      if (isNftInfoSet) {
        console.log('NFT info already set when creating new session, connecting WebSocket directly...');
        // Disconnect existing connection first
        chatServiceRef.disconnect();
        
        // Connect to new session
        chatServiceRef.connect()
          .then(() => {
            console.log('New session WebSocket connection successful');
          })
          .catch((error: Error) => {
            console.error('New session WebSocket connection failed:', error);
          });
      }
    }
    
    setSessions(prevSessions => [...prevSessions, newSession]);
    setActiveSessionId(newSession.id);
  };

  // Delete session
  const deleteSession = (id: string) => {
    const filteredSessions = sessions.filter(session => session.id !== id);
    
    // If the deleted session is the current active session
    if (id === activeSessionId) {
      if (filteredSessions.length > 0) {
        // If there are other sessions, select the first one as the active session
        const newActiveId = filteredSessions[0].id;
        setActiveSessionId(newActiveId);
        
        // Update active session ID in localStorage
        localStorage.setItem(activeSessionIdKey, newActiveId);
        console.log('After session deletion, updated active session ID to:', newActiveId);
      } else {
        // If there are no more sessions, clear activeSessionId first, then create a new session
        setActiveSessionId('');
        localStorage.removeItem(activeSessionIdKey);
        
        // Create new session
        const newSession = createInitialSession();
        filteredSessions.push(newSession); // Add to filtered array
        
        // Set as active session (executed asynchronously, in the next render cycle)
        setTimeout(() => {
          setActiveSessionId(newSession.id);
          // New session ID will be saved to localStorage in the activeSessionId useEffect
        }, 0);
      }
    }
    
    // Update session list
    setSessions(filteredSessions);
  };

  // Clear all session data for the current user
  const clearAllSessions = () => {
    // Create a new initial session
    const newSession = createInitialSession();
    
    // Reset session list to only include the new session
    setSessions([newSession]);
    setActiveSessionId(newSession.id);
    
    // Update localStorage
    localStorage.setItem(storageKey, JSON.stringify([newSession]));
    localStorage.setItem(activeSessionIdKey, newSession.id);
    
    console.log(`Cleared all session data for user ${userId || 'Not logged in'}`);
  };

  return {
    sessions,
    setSessions,
    activeSessionId,
    setActiveSessionId,
    activeSessionIdRef,
    activeSession,
    createNewSession,
    deleteSession,
    clearAllSessions
  };
} 
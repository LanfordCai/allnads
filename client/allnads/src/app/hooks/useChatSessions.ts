import { useState, useEffect, useRef } from 'react';
import { ChatSession } from '../types/chat';
import { v4 as uuidv4 } from 'uuid';

// 创建初始会话
const createInitialSession = (): ChatSession => ({
  id: uuidv4(),
  title: 'New Chat',
  messages: [],
  lastActivity: new Date(),
});

export function useChatSessions(storageKey: string) {
  // Session management
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  
  // 使用ref追踪当前活跃的会话ID，解决闭包问题
  const activeSessionIdRef = useRef<string>('');
  
  // 添加一个引用来标记初始加载是否完成
  const initialLoadCompleted = useRef<boolean>(false);

  // 从本地存储加载会话
  useEffect(() => {
    // 延迟加载，确保组件已完全挂载
    const timer = setTimeout(() => {
      console.log('开始延迟加载会话...');
      loadSessions();
    }, 100);
    
    const loadSessions = () => {
      try {
        console.log('尝试从本地存储加载会话...');
        const savedSessions = localStorage.getItem(storageKey);
        console.log('从localStorage读取的原始数据:', savedSessions);
        
        // 先检查localStorage中是否已有sessionId和activeSessionId标记
        const lastActiveId = localStorage.getItem('allnads_active_session_id');
        if (lastActiveId) {
          console.log('找到上次活跃的会话ID:', lastActiveId);
        }
        
        if (savedSessions && savedSessions.length > 2) {  // 确保不只是"[]"
          let parsedSessions;
          try {
            parsedSessions = JSON.parse(savedSessions) as ChatSession[];
            
            // 验证解析的数据是否为数组
            if (!Array.isArray(parsedSessions)) {
              console.error('解析的数据不是数组:', parsedSessions);
              throw new Error('数据格式错误: 不是数组');
            }
            
            console.log('解析后的会话数据:', parsedSessions);
          } catch (parseError) {
            console.error('JSON解析错误:', parseError);
            throw new Error('无法解析会话数据');
          }
          
          // 如果保存的是空数组，则创建一个新会话
          if (parsedSessions.length === 0) {
            console.log('保存的是空数组，创建新会话');
            const newSession = createInitialSession();
            
            // 使用函数式更新确保状态立即更新
            setSessions(() => {
              initialLoadCompleted.current = true; // 标记初始加载完成
              return [newSession];
            });
            
            setActiveSessionId(newSession.id);
            
            // 保存当前活跃会话ID
            localStorage.setItem('allnads_active_session_id', newSession.id);
            return;
          }
          
          // 验证每个会话对象的完整性
          const validSessions = parsedSessions.filter(session => {
            if (!session || !session.id || !session.title || !Array.isArray(session.messages)) {
              console.error('发现无效会话:', session);
              return false;
            }
            return true;
          });
          
          if (validSessions.length === 0) {
            console.log('没有有效的会话数据，创建新会话');
            const newSession = createInitialSession();
            
            // 使用函数式更新确保状态立即更新
            setSessions(() => {
              initialLoadCompleted.current = true; // 标记初始加载完成
              return [newSession];
            });
            
            setActiveSessionId(newSession.id);
            
            // 保存当前活跃会话ID
            localStorage.setItem('allnads_active_session_id', newSession.id);
            return;
          }
          
          // 确保日期对象正确恢复
          const processedSessions = validSessions.map(session => ({
            ...session,
            lastActivity: new Date(session.lastActivity),
            messages: session.messages.map(msg => ({
              ...msg,
              timestamp: new Date(msg.timestamp)
            }))
          }));
          
          console.log('处理后的会话数据:', processedSessions);
          
          // 使用函数式更新确保状态立即更新
          setSessions(() => {
            console.log('设置会话状态, 会话数量:', processedSessions.length);
            initialLoadCompleted.current = true; // 标记初始加载完成
            return processedSessions;
          });
          
          // 设置最近活跃的会话为当前会话
          if (processedSessions.length > 0) {
            // 按最近活动时间排序
            const sortedSessions = [...processedSessions].sort(
              (a, b) => b.lastActivity.getTime() - a.lastActivity.getTime()
            );
            const newActiveId = lastActiveId && processedSessions.some(s => s.id === lastActiveId) 
              ? lastActiveId 
              : sortedSessions[0].id;
              
            setActiveSessionId(newActiveId);
            console.log('设置活跃会话ID:', newActiveId);
            
            // 保存当前活跃会话ID
            localStorage.setItem('allnads_active_session_id', newActiveId);
          }
        } else {
          // 没有保存的会话或者只是空数组，创建一个新会话
          console.log('localStorage中没有有效会话数据，创建新会话');
          const newSession = createInitialSession();
          
          // 使用函数式更新确保状态立即更新
          setSessions(() => {
            initialLoadCompleted.current = true; // 标记初始加载完成
            return [newSession];
          });
          
          setActiveSessionId(newSession.id);
          
          // 保存当前活跃会话ID
          localStorage.setItem('allnads_active_session_id', newSession.id);
        }
      } catch (error) {
        console.error('加载会话错误:', error);
        // 出错时创建一个新会话
        const newSession = createInitialSession();
        
        // 使用函数式更新确保状态立即更新
        setSessions(() => {
          initialLoadCompleted.current = true; // 错误处理也标记初始加载完成
          return [newSession];
        });
        
        setActiveSessionId(newSession.id);
        
        // 保存当前活跃会话ID
        localStorage.setItem('allnads_active_session_id', newSession.id);
      }
    };

    // 清理定时器
    return () => clearTimeout(timer);
  }, [storageKey]);

  // 保存会话到本地存储
  useEffect(() => {
    // 如果初始加载还没完成，不要保存
    if (!initialLoadCompleted.current) {
      console.log('初始加载未完成，跳过保存到localStorage');
      return;
    }
    
    try {
      // 再次检查sessions长度
      console.log('保存会话到本地存储, 当前会话数量:', sessions.length, '会话详情:', JSON.stringify(sessions, (key, value) => {
        // 缩短消息内容以便于日志阅读
        if (key === 'content' && typeof value === 'string' && value.length > 30) {
          return value.substring(0, 30) + '...';
        }
        return value;
      }, 2).substring(0, 300) + '...');
      
      if (sessions.length === 0) {
        console.log('警告: 尝试保存空会话数组。这可能表示状态未正确更新。');
        // 验证是否真的应该保存空数组，或者这是一个异步状态问题
        if (localStorage.getItem(storageKey) && localStorage.getItem(storageKey) !== '[]') {
          console.log('localStorage中已有数据但当前状态为空，跳过保存以防止数据丢失');
          return;
        }
        console.log('保存空会话数组到localStorage');
        localStorage.setItem(storageKey, '[]');
        return;
      }
      
      // 无论是否有会话，都保存到本地存储
      // 这样当用户删除所有会话时，空数组会被保存，防止旧数据在刷新后重新出现
      const sessionsToSave = sessions.map(session => {
        // 保存前验证会话结构完整性
        if (!session || !session.id) {
          console.error('发现无效会话对象:', session);
          return null;
        }
        
        return {
          ...session,
          // 保持lastActivity和message的timestamp为字符串，避免序列化问题
          lastActivity: session.lastActivity.toISOString(),
          messages: session.messages.map(msg => ({
            ...msg,
            timestamp: msg.timestamp.toISOString()
          }))
        };
      }).filter(Boolean); // 过滤掉无效的会话
      
      console.log('即将保存的会话数据:', sessionsToSave);
      const jsonData = JSON.stringify(sessionsToSave);
      console.log('保存的JSON数据长度:', jsonData.length);
      console.log('保存的JSON数据:', jsonData.substring(0, 100) + (jsonData.length > 100 ? '...' : ''));
      
      localStorage.setItem(storageKey, jsonData);
      
      // 验证保存
      const savedData = localStorage.getItem(storageKey);
      console.log('验证保存是否成功:', !!savedData, '数据长度:', savedData?.length);
    } catch (error) {
      console.error('保存会话到本地存储失败:', error);
    }
  }, [sessions, storageKey]);

  // 获取当前活跃会话
  const activeSession = sessions.find(session => session.id === activeSessionId) || 
    (sessions.length > 0 ? sessions[0] : createInitialSession());

  // 当activeSessionId为空但sessions不为空时，自动设置activeSessionId为第一个会话
  useEffect(() => {
    if (!activeSessionId && sessions.length > 0) {
      console.log('自动设置activeSessionId为第一个会话:', sessions[0].id);
      setActiveSessionId(sessions[0].id);
    }
  }, [activeSessionId, sessions]);

  // 当activeSessionId变化时更新ref
  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
    console.log(`activeSessionId更新为: ${activeSessionId}, ref更新为: ${activeSessionIdRef.current}`);
    
    // 当activeSessionId变化时也更新localStorage中的记录
    if (activeSessionId) {
      localStorage.setItem('allnads_active_session_id', activeSessionId);
      console.log('更新localStorage中的活跃会话ID:', activeSessionId);
    }
  }, [activeSessionId]);

  // 创建新会话
  const createNewSession = (isMobile: boolean = false, chatServiceRef: any = null, isNftInfoSet: boolean = false) => {
    const newSession = createInitialSession();
    console.log(`创建新会话: ID=${newSession.id}, 初始标题="${newSession.title}"`);
    
    // Set the session ID in the chat service before updating state
    if (chatServiceRef) {
      chatServiceRef.setSessionId(newSession.id);
      
      // Store the session ID in the ref for immediate access
      activeSessionIdRef.current = newSession.id;
      
      // Update localStorage with the new active session ID
      localStorage.setItem('allnads_active_session_id', newSession.id);
      
      // 如果NFT信息已设置，直接连接WebSocket
      if (isNftInfoSet) {
        console.log('创建新会话时，NFT信息已设置，直接连接WebSocket...');
        // 先断开现有连接
        chatServiceRef.disconnect();
        
        // 连接到新会话
        chatServiceRef.connect()
          .then(() => {
            console.log('新会话WebSocket连接成功');
          })
          .catch((error: Error) => {
            console.error('新会话WebSocket连接失败:', error);
          });
      }
    }
    
    setSessions(prevSessions => [...prevSessions, newSession]);
    setActiveSessionId(newSession.id);
  };

  // 删除会话
  const deleteSession = (id: string) => {
    const filteredSessions = sessions.filter(session => session.id !== id);
    
    // 如果删除的是当前活跃会话
    if (id === activeSessionId) {
      if (filteredSessions.length > 0) {
        // 如果还有其他会话，选择第一个作为活跃会话
        const newActiveId = filteredSessions[0].id;
        setActiveSessionId(newActiveId);
        
        // 更新localStorage中的活跃会话ID
        localStorage.setItem('allnads_active_session_id', newActiveId);
        console.log('删除会话后，更新活跃会话ID为:', newActiveId);
      } else {
        // 如果没有会话了，先清除activeSessionId，然后创建一个新会话
        setActiveSessionId('');
        localStorage.removeItem('allnads_active_session_id');
        
        // 创建新会话
        const newSession = createInitialSession();
        filteredSessions.push(newSession); // 添加到过滤后的数组中
        
        // 设置为活跃会话（异步执行，在下一个渲染周期）
        setTimeout(() => {
          setActiveSessionId(newSession.id);
          // 新会话ID会在activeSessionId的useEffect中被保存到localStorage
        }, 0);
      }
    }
    
    // 更新会话列表
    setSessions(filteredSessions);
  };

  return {
    sessions,
    setSessions,
    activeSessionId,
    setActiveSessionId,
    activeSessionIdRef,
    activeSession,
    createNewSession,
    deleteSession
  };
} 
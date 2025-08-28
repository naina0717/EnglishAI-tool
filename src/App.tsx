import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { LevelSelector } from './components/LevelSelector';
import { LessonList } from './components/LessonList';
import { LessonPage } from './components/LessonPage';
import { Chatbot } from './components/Chatbot';
import { Confetti } from './components/Confetti';
import { User } from './types';
import { loadProgress, saveProgress, addXP, completeActivity } from './utils/storage';
import { checkNewBadges } from './utils/badges';
import { GeneratedLesson } from './utils/aiContentGenerator';

type View = 'dashboard' | 'level-selector' | 'lesson-list' | 'lesson';

interface AppState {
  view: View;
  selectedSkill?: keyof Omit<User, 'totalXP' | 'streak' | 'lastActiveDate' | 'badges'>;
  selectedLevel?: 'beginner' | 'intermediate' | 'advanced';
  selectedLesson?: GeneratedLesson;
}

function App() {
  const [user, setUser] = useState<User>(loadProgress());
  const [appState, setAppState] = useState<AppState>({ view: 'dashboard' });
  const [showConfetti, setShowConfetti] = useState(false);
  const [newBadges, setNewBadges] = useState<string[]>([]);

  useEffect(() => {
    saveProgress(user);
  }, [user]);

  const handleSectionSelect = (section: keyof Omit<User, 'totalXP' | 'streak' | 'lastActiveDate' | 'badges'>) => {
    setAppState({
      view: 'level-selector',
      selectedSkill: section
    });
  };

  const handleLevelSelect = (level: 'beginner' | 'intermediate' | 'advanced') => {
    setAppState(prev => ({
      ...prev,
      view: 'lesson-list',
      selectedLevel: level
    }));
  };

  const handleLessonSelect = (lesson: GeneratedLesson) => {
    setAppState(prev => ({
      ...prev,
      view: 'lesson',
      selectedLesson: lesson
    }));
  };

  const handleLessonComplete = (lessonId: string, earnedXP: number) => {
    if (!appState.selectedSkill) return;

    const updatedUser = addXP(
      completeActivity(user, appState.selectedSkill, lessonId),
      appState.selectedSkill,
      earnedXP
    );

    const badges = checkNewBadges(updatedUser);
    const hasNewBadges = badges.filter(badge => !updatedUser.badges.includes(badge));
    
    if (hasNewBadges.length > 0) {
      updatedUser.badges.push(...hasNewBadges);
      setNewBadges(hasNewBadges);
      setShowConfetti(true);
    }

    setUser(updatedUser);
    
    // Check if level is completed
    const levelXPThresholds = { beginner: 50, intermediate: 150, advanced: 300 };
    const currentLevel = appState.selectedLevel;
    const skillProgress = updatedUser[appState.selectedSkill];
    
    if (currentLevel && skillProgress.xp >= levelXPThresholds[currentLevel]) {
      setShowConfetti(true);
    }
  };

  const handleBack = () => {
    switch (appState.view) {
      case 'lesson':
        setAppState(prev => ({ ...prev, view: 'lesson-list' }));
        break;
      case 'lesson-list':
        setAppState(prev => ({ ...prev, view: 'level-selector' }));
        break;
      case 'level-selector':
        setAppState({ view: 'dashboard' });
        break;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AnimatePresence mode="wait">
        {appState.view === 'dashboard' && (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3 }}
          >
            <Header user={user} />
            <Dashboard user={user} onSectionSelect={handleSectionSelect} />
          </motion.div>
        )}

        {appState.view === 'level-selector' && appState.selectedSkill && (
          <motion.div
            key="level-selector"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3 }}
          >
            <Header user={user} />
            <LevelSelector
              title={appState.selectedSkill.charAt(0).toUpperCase() + appState.selectedSkill.slice(1)}
              icon={getSkillIcon(appState.selectedSkill)}
              progress={user[appState.selectedSkill]}
              onLevelSelect={handleLevelSelect}
              onBack={handleBack}
            />
          </motion.div>
        )}

        {appState.view === 'lesson-list' && appState.selectedSkill && appState.selectedLevel && (
          <motion.div
            key="lesson-list"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3 }}
          >
            <Header user={user} />
            <LessonList
              skill={appState.selectedSkill}
              level={appState.selectedLevel}
              user={user}
              onLessonSelect={handleLessonSelect}
              onBack={handleBack}
            />
          </motion.div>
        )}

        {appState.view === 'lesson' && appState.selectedLesson && appState.selectedSkill && (
          <motion.div
            key="lesson"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3 }}
          >
            <Header user={user} />
            <ErrorBoundary>
              <LessonPage
                lesson={appState.selectedLesson}
                skill={appState.selectedSkill}
                onComplete={handleLessonComplete}
                onBack={handleBack}
              />
            </ErrorBoundary>
          </motion.div>
        )}
      </AnimatePresence>

      <Chatbot />
      
      <Confetti 
        show={showConfetti} 
        onComplete={() => {
          setShowConfetti(false);
          setNewBadges([]);
        }} 
      />

      {/* Badge Notification */}
      <AnimatePresence>
        {newBadges.length > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 50 }}
            className="fixed bottom-20 left-1/2 transform -translate-x-1/2 bg-white rounded-xl shadow-2xl p-6 border-2 border-yellow-300 z-50"
          >
            <div className="text-center">
              <h3 className="text-lg font-bold text-gray-800 mb-2">🎉 New Badge Earned!</h3>
              {newBadges.map(badgeId => {
                const badge = require('./utils/badges').badges.find((b: any) => b.id === badgeId);
                return badge ? (
                  <div key={badgeId} className="flex items-center space-x-2 justify-center">
                    <span className="text-2xl">{badge.icon}</span>
                    <span className="font-semibold">{badge.name}</span>
                  </div>
                ) : null;
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function getSkillIcon(skill: string): string {
  const icons = {
    listening: '🎧',
    reading: '📖',
    speaking: '🗣️',
    writing: '✍️',
    grammar: '📘',
    vocabulary: '🧩'
  };
  return icons[skill as keyof typeof icons] || '📚';
}

export default App;
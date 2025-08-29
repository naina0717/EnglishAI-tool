import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Play, Pause, Mic, MicOff, Send, Volume2 } from 'lucide-react';
import { ErrorBoundary } from './ErrorBoundary';
import { GeneratedLesson, Assignment } from '../utils/aiContentGenerator';
import { checkOpenAnswer, checkSpeakingAnswer, checkWritingAnswer, AIFeedback } from '../utils/aiChecker';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { User } from '../types';

interface LessonPageProps {
  lesson: GeneratedLesson;
  skill: keyof Omit<User, 'totalXP' | 'streak' | 'lastActiveDate' | 'badges'>;
  onComplete: (lessonId: string, earnedXP: number) => void;
  onBack: () => void;
}

interface Answer {
  assignmentId: string;
  answer: string | number | boolean;
  feedback?: AIFeedback;
}

export function LessonPage({ lesson, skill, onComplete, onBack }: LessonPageProps) {
  const [currentStep, setCurrentStep] = useState<'tutorial' | 'assignments'>('tutorial');
  const [currentAssignment, setCurrentAssignment] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [writingText, setWritingText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [totalScore, setTotalScore] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [currentFeedback, setCurrentFeedback] = useState<AIFeedback | null>(null);
  const [audioChunks, setAudioChunks] = useState<string[]>([]);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0);
  const [isAudioReady, setIsAudioReady] = useState(false);

  const { isListening, transcript, startListening, stopListening, resetTranscript } = useSpeechRecognition();

  const currentAssignmentData = lesson.assignments[currentAssignment];

  // Assignment type registry
  const supportedTypes = ['mcq', 'true-false', 'fill-blank', 'open', 'speaking', 'writing', 'matching', 'vocabulary', 'grammar'];

  useEffect(() => {
    // Split audio text into chunks for better TTS handling
    if (skill === 'listening' && lesson.content?.audioText) {
      const sentences = lesson.content.audioText.match(/[^\.!?]+[\.!?]+/g) || [lesson.content.audioText];
      setAudioChunks(sentences.map(s => s.trim()));
      setIsAudioReady(true);
    }
  }, [lesson.content?.audioText, skill]);

  // Text-to-Speech for listening exercises
  const playAudio = () => {
    if ('speechSynthesis' in window) {
      setIsPlaying(true);
      setCurrentChunkIndex(0);
      playChunk(0);
    }
  };

  const playChunk = (chunkIndex: number) => {
    if (chunkIndex >= audioChunks.length) {
      setIsPlaying(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(audioChunks[chunkIndex]);
    utterance.rate = 0.8;
    utterance.pitch = 1;
    utterance.volume = 1;
    
    utterance.onend = () => {
      const nextIndex = chunkIndex + 1;
      setCurrentChunkIndex(nextIndex);
      if (nextIndex < audioChunks.length && isPlaying) {
        setTimeout(() => playChunk(nextIndex), 200); // Small pause between chunks
      } else {
        setIsPlaying(false);
      }
    };
    
    speechSynthesis.speak(utterance);
  };

  const restartAudio = () => {
    stopAudio();
    setTimeout(() => playAudio(), 100);
  };

  const stopAudio = () => {
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
      setIsPlaying(false);
    }
  };

  const handleAnswer = async (answer: string | number | boolean) => {
    if (!currentAssignmentData || isSubmitting) return;

    setIsSubmitting(true);
    setShowFeedback(false);
    setCurrentFeedback(null);

    try {
      let feedback: AIFeedback | undefined;

      // Get AI feedback for open-ended questions
      if (currentAssignmentData.type === 'open' || currentAssignmentData.type === 'speaking' || currentAssignmentData.type === 'writing') {
        if (currentAssignmentData.type === 'speaking') {
          feedback = await checkSpeakingAnswer(currentAssignmentData.question, answer as string);
        } else if (currentAssignmentData.type === 'writing') {
          feedback = await checkWritingAnswer(currentAssignmentData.question, answer as string);
        } else {
          feedback = await checkOpenAnswer(currentAssignmentData.question, answer as string, currentAssignmentData.context);
        }
      } else {
        // For MCQ, true/false, fill-blank - check immediately
        const isCorrect = answer === currentAssignmentData.correctAnswer;
        feedback = {
          correct: isCorrect,
          score: isCorrect ? 100 : 0,
          feedback: isCorrect ? 'Correct! Well done.' : `Not quite right. The correct answer is: ${currentAssignmentData.correctAnswer}`
        };
      }

      const newAnswer: Answer = {
        assignmentId: currentAssignmentData.id,
        answer,
        feedback
      };

      const updatedAnswers = [...answers.filter(a => a.assignmentId !== currentAssignmentData.id), newAnswer];
      setAnswers(updatedAnswers);

      // Calculate score
      let points = 0;
      if (feedback) {
        points = Math.round((feedback.score / 100) * currentAssignmentData.points);
      }

      setTotalScore(prev => prev + points);
      setCurrentFeedback(feedback);
      setShowFeedback(true);
      
    } catch (error: any) {
      console.error('Error handling answer:', error);
      setCurrentFeedback({
        correct: false,
        score: 0,
        feedback: 'Sorry, there was an error processing your answer. Please try again.'
      });
      setShowFeedback(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNext = () => {
    try {
      if (currentAssignment < lesson.assignments.length - 1) {
        setCurrentAssignment(prev => prev + 1);
        resetTranscript();
        setShowFeedback(false);
        setCurrentFeedback(null);
      } else {
        setIsCompleted(true);
        onComplete(lesson.id, totalScore);
      }
    } catch (error) {
      console.error('Error advancing to next question:', error);
    }
  };

  const handleRetry = () => {
    // Reset all form states
    setShowFeedback(false);
    setCurrentFeedback(null);
    setWritingText('');
    resetTranscript();
    setIsSubmitting(false);
  };

  const renderAssignment = () => {
    if (!currentAssignmentData) {
      return (
        <div className="text-center p-8">
          <p className="text-gray-600 mb-4">No assignment data available</p>
          <button onClick={handleNext} className="bg-blue-600 text-white px-4 py-2 rounded-lg">
            Continue
          </button>
        </div>
      );
    }

    const existingAnswer = answers.find(a => a.assignmentId === currentAssignmentData.id);

    switch (currentAssignmentData.type) {
      case 'mcq':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold mb-4">{currentAssignmentData.question}</h3>
            <div className="space-y-2">
              {currentAssignmentData.options?.map((option, index) => (
                <button
                  key={index}
                  onClick={() => handleAnswer(index)}
                  disabled={existingAnswer || isSubmitting || showFeedback}
                  className={`w-full p-3 text-left rounded-lg border transition-colors ${
                    existingAnswer
                      ? index === currentAssignmentData.correctAnswer
                        ? 'bg-green-100 border-green-500 text-green-800'
                        : index === existingAnswer.answer
                        ? 'bg-red-100 border-red-500 text-red-800'
                        : 'bg-gray-100 border-gray-300'
                      : 'bg-white border-gray-300 hover:border-blue-500 hover:bg-blue-50'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        );

      case 'true-false':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold mb-4">{currentAssignmentData.question}</h3>
            <div className="flex space-x-4">
              {[true, false].map((value) => (
                <button
                  key={value.toString()}
                  onClick={() => handleAnswer(value)}
                  disabled={existingAnswer || isSubmitting || showFeedback}
                  className={`flex-1 p-3 rounded-lg border transition-colors ${
                    existingAnswer
                      ? value === currentAssignmentData.correctAnswer
                        ? 'bg-green-100 border-green-500 text-green-800'
                        : value === existingAnswer.answer
                        ? 'bg-red-100 border-red-500 text-red-800'
                        : 'bg-gray-100 border-gray-300'
                      : 'bg-white border-gray-300 hover:border-blue-500 hover:bg-blue-50'
                  }`}
                >
                  {value ? 'True' : 'False'}
                </button>
              ))}
            </div>
          </div>
        );

      case 'fill-blank':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold mb-4">{currentAssignmentData.question}</h3>
            <div className="flex space-x-2">
              <input
                type="text"
                placeholder="Type your answer..."
                className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                    handleAnswer(e.currentTarget.value.trim());
                  }
                }}
                disabled={existingAnswer || isSubmitting || showFeedback}
              />
              <button
                onClick={(e) => {
                  const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                  if (input.value.trim()) {
                    handleAnswer(input.value.trim());
                  }
                }}
                disabled={existingAnswer || isSubmitting || showFeedback}
                className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            {existingAnswer && (
              <div className={`p-3 rounded-lg ${
                existingAnswer.answer === currentAssignmentData.correctAnswer
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}>
                Your answer: {existingAnswer.answer}
                {existingAnswer.answer !== currentAssignmentData.correctAnswer && (
                  <div className="mt-1">Correct answer: {currentAssignmentData.correctAnswer}</div>
                )}
              </div>
            )}
          </div>
        );

      case 'speaking':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold mb-4">{currentAssignmentData.question}</h3>
            {currentAssignmentData.context && (
              <p className="text-gray-600 mb-4">{currentAssignmentData.context}</p>
            )}
            
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center justify-center space-x-4 mb-4">
                <button
                  onClick={isListening ? stopListening : startListening}
                  disabled={existingAnswer || isSubmitting}
                  className={`p-4 rounded-full transition-colors ${
                    isListening
                      ? 'bg-red-500 text-white animate-pulse'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  } disabled:opacity-50`}
                >
                  {isListening ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                </button>
              </div>
              
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-2">
                  {isListening ? 'Listening... Speak now!' : 'Click the microphone to start recording'}
                </p>
                {transcript && (
                  <div className="bg-white p-3 rounded border">
                    <p className="text-sm font-medium">You said:</p>
                    <p className="text-gray-800">{transcript}</p>
                    {!showFeedback && !existingAnswer && (
                      <button
                        onClick={() => handleAnswer(transcript)}
                        disabled={isSubmitting}
                        className="mt-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                      >
                        {isSubmitting ? 'Submitting...' : 'Submit Answer'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 'writing':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold mb-4">{currentAssignmentData.question}</h3>
            {currentAssignmentData.instructions && (
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-semibold text-blue-800 mb-2">Instructions:</h4>
                <ul className="list-disc list-inside text-blue-700 space-y-1">
                  {currentAssignmentData.instructions.map((instruction: string, index: number) => (
                    <li key={index}>{instruction}</li>
                  ))}
                </ul>
              </div>
            )}
            
            <textarea
              value={writingText}
              onChange={(e) => setWritingText(e.target.value)}
              placeholder="Write your answer here..."
              className="w-full h-40 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none disabled:bg-gray-100"
              disabled={isSubmitting || showFeedback}
            />
            
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">
                Words: {writingText.trim().split(/\s+/).filter(word => word.length > 0).length}
                {currentAssignmentData.minWords && ` (min: ${currentAssignmentData.minWords})`}
              </span>
              {!showFeedback && (
                <button
                  onClick={() => handleAnswer(writingText)}
                  disabled={!writingText.trim() || isSubmitting}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit'}
                </button>
              )}
            </div>
          </div>
        );

      case 'open':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold mb-4">{currentAssignmentData.question}</h3>
            <textarea
              placeholder="Type your detailed answer here..."
              className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none disabled:bg-gray-100"
              disabled={isSubmitting || showFeedback}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && e.ctrlKey && e.currentTarget.value.trim()) {
                  handleAnswer(e.currentTarget.value.trim());
                }
              }}
            />
            {!showFeedback && (
              <div className="flex justify-end">
                <button
                  onClick={(e) => {
                    const textarea = e.currentTarget.previousElementSibling as HTMLTextAreaElement;
                    if (textarea.value.trim()) {
                      handleAnswer(textarea.value.trim());
                    }
                  }}
                  disabled={isSubmitting}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit'}
                </button>
              </div>
            )}
          </div>
        );

      case 'matching':
      case 'vocabulary':
        // Handle vocabulary-specific assignments
        if (currentAssignmentData.type === 'vocabulary' || currentAssignmentData.type === 'matching') {
          return (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold mb-4">{currentAssignmentData.question}</h3>
              <div className="space-y-2">
                {currentAssignmentData.options?.map((option, index) => (
                  <button
                    key={index}
                    onClick={() => handleAnswer(index)}
                    disabled={existingAnswer || isSubmitting || showFeedback}
                    className={`w-full p-3 text-left rounded-lg border transition-colors ${
                      existingAnswer
                        ? index === currentAssignmentData.correctAnswer
                          ? 'bg-green-100 border-green-500 text-green-800'
                          : index === existingAnswer.answer
                          ? 'bg-red-100 border-red-500 text-red-800'
                          : 'bg-gray-100 border-gray-300'
                        : 'bg-white border-gray-300 hover:border-blue-500 hover:bg-blue-50'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          );
        }
        return null;

      case 'grammar':
        // Handle grammar-specific assignments (same as fill-blank for now)
        return renderAssignment();

      default:
        // Show skip option for truly unknown types
        return (
          <div className="text-center p-8 bg-yellow-50 rounded-lg">
            <div className="text-4xl mb-4">🚧</div>
            <h3 className="text-lg font-semibold text-yellow-800 mb-2">Assignment Type Not Supported Yet</h3>
            <p className="text-yellow-700 mb-4">
              The assignment type "{currentAssignmentData.type}" is not implemented yet.
            </p>
            <button 
              onClick={handleNext}
              className="bg-yellow-600 text-white px-6 py-2 rounded-lg hover:bg-yellow-700"
            >
              Skip and Continue
            </button>
          </div>
        );
    }
  };

  if (isCompleted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-xl shadow-2xl p-8 text-center max-w-md w-full"
        >
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Lesson Complete!</h2>
          <p className="text-gray-600 mb-4">You earned {totalScore} XP</p>
          <button
            onClick={onBack}
            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Continue Learning
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={onBack}
          className="mb-6 flex items-center space-x-2 text-blue-600 hover:text-blue-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-800">{lesson.title}</h1>
            <div className="flex space-x-2">
              <button
                onClick={() => setCurrentStep('tutorial')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  currentStep === 'tutorial'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Tutorial
              </button>
              <button
                onClick={() => setCurrentStep('assignments')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  currentStep === 'assignments'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Practice ({currentAssignment + 1}/{lesson.assignments.length})
              </button>
            </div>
          </div>

          {currentStep === 'tutorial' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="prose max-w-none">
                <div className="bg-blue-50 p-6 rounded-lg">
                  <h3 className="text-lg font-semibold text-blue-800 mb-3">Lesson Overview</h3>
                  <div className="text-blue-700 whitespace-pre-wrap">{lesson.tutorial}</div>
                </div>
              </div>

              {/* Display lesson content based on skill type */}
              {skill === 'listening' && lesson.content?.audioText && isAudioReady && (
                <div className="bg-gray-50 p-6 rounded-lg">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold text-gray-800">Audio Content</h4>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => isPlaying ? stopAudio() : playAudio()}
                        className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                      >
                        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        <span>{isPlaying ? 'Stop' : 'Play'}</span>
                        <Volume2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={restartAudio}
                        className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
                      >
                        Restart
                      </button>
                    </div>
                  </div>
                  <p className="text-gray-700 leading-relaxed">{lesson.content.audioText}</p>
                  {isPlaying && (
                    <div className="mt-2 text-sm text-blue-600">
                      Playing chunk {currentChunkIndex + 1} of {audioChunks.length}
                    </div>
                  )}
                </div>
              )}

              {skill === 'reading' && lesson.content?.passage && (
                <div className="bg-gray-50 p-6 rounded-lg">
                  <h4 className="font-semibold text-gray-800 mb-4">Reading Passage</h4>
                  <div className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {lesson.content.passage}
                  </div>
                </div>
              )}

              {skill === 'vocabulary' && lesson.content?.words && (
                <div className="bg-gray-50 p-6 rounded-lg">
                  <h4 className="font-semibold text-gray-800 mb-4">Vocabulary Words</h4>
                  <div className="grid gap-4">
                    {lesson.content.words.map((word: any, index: number) => (
                      <div key={index} className="bg-white p-4 rounded-lg border">
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="font-bold text-lg text-blue-600">{word.word}</h5>
                          {word.pronunciation && (
                            <span className="text-sm text-gray-500">{word.pronunciation}</span>
                          )}
                        </div>
                        <p className="text-gray-700 mb-2">{word.definition}</p>
                        <p className="text-sm text-gray-600 italic">"{word.example}"</p>
                        {word.synonyms && word.synonyms.length > 0 && (
                          <p className="text-sm text-blue-600 mt-2">
                            Synonyms: {word.synonyms.join(', ')}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={() => setCurrentStep('assignments')}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Start Practice
                </button>
              </div>
            </motion.div>
          )}

          {currentStep === 'assignments' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">
                  Question {currentAssignment + 1} of {lesson.assignments.length}
                </h3>
                <div className="text-sm text-gray-600">
                  Score: {totalScore} XP
                </div>
              </div>

              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${((currentAssignment + 1) / lesson.assignments.length) * 100}%` }}
                />
              </div>

              <ErrorBoundary>
                {renderAssignment()}
              </ErrorBoundary>

              {/* Feedback Panel */}
              {showFeedback && currentFeedback && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-4 rounded-lg ${
                    currentFeedback.correct ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                  }`}
                >
                  <h4 className={`font-semibold mb-2 ${
                    currentFeedback.correct ? 'text-green-800' : 'text-red-800'
                  }`}>
                    {currentFeedback.correct ? '✅ Correct!' : '❌ Not Quite Right'}
                  </h4>
                  <p className={`mb-3 ${
                    currentFeedback.correct ? 'text-green-700' : 'text-red-700'
                  }`}>
                    {currentFeedback.feedback.length > 200 ? currentFeedback.feedback.substring(0, 200) + '...' : currentFeedback.feedback}
                  </p>
                  <p className="text-sm text-gray-600 mb-4">
                    Score: {currentFeedback.score}/100
                  </p>
                  <div className="flex space-x-2">
                    <button
                      onClick={handleNext}
                      className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
                    >
                      {currentAssignment < lesson.assignments.length - 1 ? 'Next Question' : 'Complete Lesson'}
                    </button>
                    {!currentFeedback.correct && (
                      <button
                        onClick={handleRetry}
                        className="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700"
                      >
                        Try Again
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
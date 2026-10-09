/* Global state variables and DOM references */
// ============ State Variables ============
const chatEl = document.getElementById('chat');
const inputEl = document.getElementById('input');
const sendBtn = document.getElementById('send');
const levelEl = document.getElementById('level');
const languageEl = document.getElementById('languageSelector');
const attachBtn = document.getElementById('attachBtn');
const imageInput = document.getElementById('imageInput');
const quizModal = document.getElementById('quizModal');
const imagePreviewContainer = document.getElementById('imagePreviewContainer');

let history = [];
let pendingImage = null;
let currentQuiz = null;
let quizAnswers = {};
let agentMode = false;
let socraticMode = false;
let socraticTurn = 0;
let socraticTopic = '';
let currentLanguage = localStorage.getItem('studybuddy-language') || 'English';

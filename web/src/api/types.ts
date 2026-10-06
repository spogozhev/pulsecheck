export type UserStatus = 'pending' | 'approved' | 'blocked';

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  /** демо-аккаунт: имя, email и пароль не редактируются */
  isDemo: boolean;
}

export interface AdminUserRow {
  id: string;
  email: string;
  name: string;
  role: string;
  status: UserStatus;
  createdAt: string;
  _count?: { presentations: number; lectures: number };
}

export interface PollOption {
  id: string;
  text: string;
  position: number;
}

export type PollType = 'single' | 'multiple' | 'ranking';

export interface Poll {
  id: string;
  slideId: string;
  questionText: string;
  type: PollType;
  required: boolean;
  timeLimitSeconds: number | null;
  options: PollOption[];
}

export interface Slide {
  id: string;
  presentationId: string;
  index: number;
  imagePath: string | null;
  isGenerated: boolean;
  poll: Poll | null;
}

export type PresentationStatus = 'processing' | 'ready' | 'failed';

export interface Presentation {
  id: string;
  title: string;
  course: string | null;
  sourceType: 'pdf' | 'pptx';
  status: PresentationStatus;
  error?: string | null;
  slideCount: number;
  createdAt: string;
  slides?: Slide[];
  _count?: { slides: number; lectures: number };
}

export interface Lecture {
  id: string;
  title: string;
  course: string | null;
  status: 'active' | 'finished';
  startedAt: string;
  endedAt: string | null;
  voteCode: string;
  slideCount: number;
  answersCount?: number;
  presentation?: { id: string; title: string };
}

export interface LecturePage {
  items: Lecture[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface OptionResult {
  id: string;
  text: string;
  position: number;
  count: number;
  share: number;
  avgRank: number | null;
  points: number;
}

export interface PollResults {
  pollId: string;
  questionText: string;
  type: PollType | string;
  totalResponses: number;
  answeredNonEmpty: number;
  options: OptionResult[];
}

export interface LectureStatePoll {
  id: string;
  type: PollType;
  questionText: string;
  required: boolean;
  options: PollOption[];
  votedCount: number;
}

export interface LectureState {
  id: string;
  title: string;
  course: string | null;
  status: 'active' | 'finished';
  currentSlideIndex: number;
  slideCount: number;
  voteCode: string;
  voteUrl: string;
  linkAnswers: boolean;
  startedAt: string;
  answersTotal: number;
  pendingResults: { slideIndex: number; pollId: string } | null;
  secondsLeft: number | null;
  presentation: { id: string; title: string };
  slide: {
    index: number;
    hasImage: boolean;
    imageUrl: string | null;
    isGenerated: boolean;
    poll: (LectureStatePoll & { timeLimitSeconds: number | null }) | null;
  } | null;
}

export interface VotePayload {
  open: boolean;
  lectureTitle: string;
  question: {
    id: string;
    type: PollType;
    required: boolean;
    questionText: string;
    timeLimitSeconds: number | null;
    secondsLeft: number | null;
    options: PollOption[];
  } | null;
  yourAnswer: { selectedOptionIds: string[]; rankingOrder: string[] } | null;
}

export interface VoteResultsResponse {
  closed: boolean;
  results?: PollResults;
}

export interface AnalyticsPoll {
  slideIndex: number;
  pollId: string;
  questionText: string;
  type: PollType | string;
  results: PollResults;
  responseTimestamps: string[];
}

export interface Analytics {
  lecture: {
    id: string;
    title: string;
    course: string | null;
    status: string;
    startedAt: string;
    endedAt: string | null;
    linkAnswers: boolean;
    voteCode: string;
    currentSlideIndex: number;
    slideCount: number;
  };
  presentation: { id: string; title: string; sourceType: string };
  polls: AnalyticsPoll[];
  participants: number;
  totalAnswers: number;
}

export function slideImageUrl(slide: Pick<Slide, 'imagePath'>): string | null {
  return slide.imagePath ? `/api/storage/${slide.imagePath}` : null;
}

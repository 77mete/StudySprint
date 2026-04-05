/** Ortak domain ve socket yükleri — PRD ile uyumlu */
export type ParticipantStatus = 'waiting' | 'ready' | 'pending' | 'offline';
export type RoomPhase = 'lobby' | 'countdown' | 'sprint' | 'debrief' | 'results';
export type PublicParticipant = {
    id: string;
    displayName: string;
    status: ParticipantStatus;
    isAnonymous: boolean;
    distractionCount: number;
    completedTasks: number | null;
    debriefSubmitted: boolean;
};
export type PublicRoomState = {
    slug: string;
    /** Oda başlığı (kurucunun verdiği ad) */
    roomName: string;
    /** Toplam kişi kapasitesi (kurucu dahil) */
    maxParticipants: number;
    requiresApproval: boolean;
    phase: RoomPhase;
    durationMinutes: number;
    targetTasks: number;
    hasPassword: boolean;
    ownerId: string;
    /** Kurucu: tüm çevrimiçi katılımcılar hazırsa true */
    canOwnerStart: boolean;
    countdownGen: number;
    countdownStep: number | null;
    sprintEndsAt: number | null;
    debriefDeadlineAt: number | null;
    participants: PublicParticipant[];
    serverMessage: string | null;
};
export type RoomCreatePayload = {
    roomName: string;
    durationMinutes: number;
    targetTasks: number;
    /** Toplam kişi sayısı (kurucu dahil), örn. 8 */
    maxParticipants: number;
    password?: string;
    displayName: string;
    isAnonymous: boolean;
    requiresApproval: boolean;
    clientId: string;
};
export type RoomJoinPayload = {
    slug: string;
    password?: string;
    displayName: string;
    isAnonymous: boolean;
    clientId: string;
};
export type RoomPeekResponse = {
    ok: false;
    error: string;
} | {
    ok: true;
    roomName: string;
    hasPassword: boolean;
    maxParticipants: number;
    participantCount: number;
};
export type DebriefSubmitPayload = {
    slug: string;
    clientId: string;
    completedTasks: number;
    /** İşaretliyse, bu kullanıcının sonuçları diğer kullanıcılara gizli gösterilir. */
    hideResults: boolean;
};
export type OwnerKickPayload = {
    slug: string;
    ownerClientId: string;
    targetParticipantId: string;
};
export type OwnerApprovePayload = {
    slug: string;
    ownerClientId: string;
    targetParticipantId: string;
};
export type OwnerApproveAllPayload = {
    slug: string;
    ownerClientId: string;
};
export type OwnerExtendPayload = {
    slug: string;
    ownerClientId: string;
    extraMinutes?: number;
};
export type SessionDistractionPayload = {
    slug: string;
    clientId: string;
};
export type RoomAckOk = {
    ok: true;
    slug: string;
    invitePath: string;
};
export type RoomAckErr = {
    ok: false;
    error: string;
};
export type RoomJoinAck = RoomAckOk | RoomAckErr;
export type ResultHighlight = {
    participantId: string;
    displayLabel: string;
    completedTasks: number;
    targetPercent: number;
    isTop: boolean;
    /** Bu highlight'in diğer kullanıcılara gizli görünmesi gerekir. */
    isHidden: boolean;
};
export type SessionResultsPayload = {
    slug: string;
    targetTasks: number;
    averageCompleted: number;
    highlights: ResultHighlight[];
};
//# sourceMappingURL=index.d.ts.map
import { create } from 'zustand'

export const useAppStore = create((set, get) => ({
  // Auth
  user: null,
  profile: null,
  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),

  // Admin state
  students: [],
  historyData: [],
  setStudents: (students) => set({ students }),
  setHistoryData: (historyData) => set({ historyData }),

  // Student portal state
  myStudent: null,
  myPayments: [],
  myAttendance: [],
  myExam: null,
  schedules: [],
  setMyStudent: (myStudent) => set({ myStudent }),
  setMyPayments: (myPayments) => set({ myPayments }),
  setMyAttendance: (myAttendance) => set({ myAttendance }),
  setMyExam: (myExam) => set({ myExam }),
  setSchedules: (schedules) => set({ schedules }),

  // Toast
  toast: null,
  showToast: (msg, type = 'success') => {
    set({ toast: { msg, type } })
    setTimeout(() => set({ toast: null }), 3500)
  },

  // Settings
  priceTiers: { tier1: 12500, tier2: 15000, tier3: 18000 },
  setPriceTiers: (tiers) => set({ priceTiers: tiers }),
}))

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useAdminAuthStore = create(
  persist(
    (set, get) => ({
      adminToken: null,
      admin: null,
      isAuthenticated: false,

      setAdminAuth: (token, admin) => {
        set({
          adminToken: token,
          admin: admin,
          isAuthenticated: true,
        });
      },

      clearAdminAuth: () => {
        set({
          adminToken: null,
          admin: null,
          isAuthenticated: false,
        });
        // Clear all admin data from localStorage
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminData');
        localStorage.removeItem('admin-auth-storage'); // Clear Zustand persist storage
      },

      checkAuth: () => {
        const token = localStorage.getItem('adminToken');
        const storedAdmin = localStorage.getItem('adminData');
        
        if (!token || !storedAdmin) {
          get().clearAdminAuth();
          return false;
        }
        
        try {
          const admin = JSON.parse(storedAdmin);
          set({
            adminToken: token,
            admin: admin,
            isAuthenticated: true,
          });
          return true;
        } catch (e) {
          get().clearAdminAuth();
          return false;
        }
      },
    }),
    {
      name: 'admin-auth-storage',
      partialize: (state) => ({
        adminToken: state.adminToken,
        admin: state.admin,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

export default useAdminAuthStore;


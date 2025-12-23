import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const usePaymentAdminAuthStore = create(
  persist(
    (set, get) => ({
      paymentAdminToken: null,
      paymentAdmin: null,
      isAuthenticated: false,

      setPaymentAdminAuth: (token, paymentAdmin) => {
        set({
          paymentAdminToken: token,
          paymentAdmin: paymentAdmin,
          isAuthenticated: true,
        });
      },

      clearPaymentAdminAuth: () => {
        set({
          paymentAdminToken: null,
          paymentAdmin: null,
          isAuthenticated: false,
        });
        // Clear all payment admin data from localStorage
        localStorage.removeItem('paymentAdminToken');
        localStorage.removeItem('paymentAdminData');
        localStorage.removeItem('payment-admin-auth-storage'); // Clear Zustand persist storage
      },

      checkAuth: () => {
        const token = localStorage.getItem('paymentAdminToken');
        const storedPaymentAdmin = localStorage.getItem('paymentAdminData');
        
        if (!token || !storedPaymentAdmin) {
          get().clearPaymentAdminAuth();
          return false;
        }
        
        try {
          const paymentAdmin = JSON.parse(storedPaymentAdmin);
          set({
            paymentAdminToken: token,
            paymentAdmin: paymentAdmin,
            isAuthenticated: true,
          });
          return true;
        } catch (e) {
          get().clearPaymentAdminAuth();
          return false;
        }
      },
    }),
    {
      name: 'payment-admin-auth-storage',
      partialize: (state) => ({
        paymentAdminToken: state.paymentAdminToken,
        paymentAdmin: state.paymentAdmin,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

export default usePaymentAdminAuthStore;


import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../db';

import { hashPin, legacyHashPin } from '../utils/security';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [currentShift, setCurrentShift] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if there is an active shift
    const initAuth = async () => {
      try {
        const storedUserId = localStorage.getItem('pos_current_user_id');
        if (storedUserId) {
          const user = await db.users.get(parseInt(storedUserId));
          if (user && user.isActive) {
            setCurrentUser(user);
            
            // Look for an active shift for this user
            const shift = await db.shifts
              .where('userId')
              .equals(user.id)
              .filter(s => s.status === 'active')
              .first();
              
            if (shift) {
              setCurrentShift(shift);
            }
          } else {
            localStorage.removeItem('pos_current_user_id');
          }
        }
      } catch (err) {
        console.error("Error initializing auth:", err);
      } finally {
        setLoading(false);
      }
    };
    initAuth();
  }, []);

  const login = async (username, pin) => {
    try {
      const hashedPin = await hashPin(pin);
      const legacyHashed = await legacyHashPin(pin);
      
      // Find user by username
      const user = await db.users.where('username').equals(username).first();
      
      if (user && user.isActive) {
        let isValid = false;
        
        if (user.pinHash === hashedPin) {
          isValid = true;
        } else if (user.pinHash === legacyHashed) {
          isValid = true;
          // Auto-migrate to new salted hash
          await db.users.update(user.id, { pinHash: hashedPin });
        }
        
        if (isValid) {
        setCurrentUser(user);
        localStorage.setItem('pos_current_user_id', user.id);
        
        // Find active shift
        const shift = await db.shifts
          .where('userId')
          .equals(user.id)
          .filter(s => s.status === 'active')
          .first();
          
        if (shift) {
          setCurrentShift(shift);
        }
        
        // Clock In if not already clocked in today
        const today = new Date().toISOString().split('T')[0];
        const existingAttendance = await db.attendance
          .where('userId')
          .equals(user.id)
          .filter(a => a.date === today && !a.clockOut)
          .first();
          
        if (!existingAttendance) {
          await db.attendance.add({
            userId: user.id,
            clockIn: Date.now(),
            clockOut: null,
            date: today,
            totalHours: 0
          });
        }
        
        return { success: true, user };
        }
      }
      return { success: false, error: 'Mã PIN không đúng hoặc tài khoản đã bị khóa' };
    } catch (err) {
      console.error("Login error:", err);
      return { success: false, error: 'Lỗi hệ thống khi đăng nhập' };
    }
  };

  const logout = async () => {
    try {
      if (currentUser) {
        // Find active attendance and clock out if no active shift
        if (!currentShift) {
          const today = new Date().toISOString().split('T')[0];
          const attendance = await db.attendance
            .where('userId')
            .equals(currentUser.id)
            .filter(a => a.date === today && !a.clockOut)
            .first();
            
          if (attendance) {
            const clockOut = Date.now();
            const totalHours = (clockOut - attendance.clockIn) / (1000 * 60 * 60);
            await db.attendance.update(attendance.id, {
              clockOut,
              totalHours
            });
          }
        }
      }
    } catch (err) {
      console.error("Error on logout:", err);
    } finally {
      setCurrentUser(null);
      setCurrentShift(null);
      localStorage.removeItem('pos_current_user_id');
    }
  };

  const startShift = async (startingCash) => {
    if (!currentUser) return null;
    
    try {
      const shiftId = await db.shifts.add({
        userId: currentUser.id,
        startTime: Date.now(),
        endTime: null,
        startingCash: parseInt(startingCash) || 0,
        expectedCash: parseInt(startingCash) || 0,
        actualCash: 0,
        difference: 0,
        status: 'active'
      });
      
      const newShift = await db.shifts.get(shiftId);
      setCurrentShift(newShift);
      return newShift;
    } catch (err) {
      console.error("Error starting shift:", err);
      return null;
    }
  };

  const endShift = async (actualCash, autoLogout = true) => {
    if (!currentShift) return null;
    
    try {
      // Calculate expected cash based on orders during this shift
      const shiftOrders = await db.orders
        .where('shiftId')
        .equals(currentShift.id)
        .toArray();
        
      const cashSales = shiftOrders
        .filter(o => o.paymentMethod === 'cash')
        .reduce((sum, o) => sum + (o.cashReceived || o.total) - (o.changeAmount || 0), 0);
        
      const expectedCash = currentShift.startingCash + cashSales;
      const difference = actualCash - expectedCash;
      
      const shiftDataToReturn = { ...currentShift }; // Save a copy before clearing

      await db.shifts.update(currentShift.id, {
        endTime: Date.now(),
        expectedCash,
        actualCash,
        difference,
        status: 'closed'
      });
      
      setCurrentShift(null);
      
      if (autoLogout) {
        await logout();
      }
      
      return { success: true, difference, expectedCash, shiftOrders, shift: shiftDataToReturn };
    } catch (err) {
      console.error("Error ending shift:", err);
      return { success: false, error: err.message };
    }
  };

  return (
    <AuthContext.Provider value={{
      currentUser,
      currentShift,
      loading,
      login,
      logout,
      startShift,
      endShift
    }}>
      {children}
    </AuthContext.Provider>
  );
};

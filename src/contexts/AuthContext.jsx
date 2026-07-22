import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../db';

import { hashPin, legacyHashPin } from '../utils/security';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

const getLocalDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toFiniteAmount = (value, fallback = 0) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : fallback;
};

const getStoredAmount = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
};

const clampAmount = (value, max) => Math.min(Math.max(value, 0), max);

const getOrderPaymentBreakdown = (order) => {
  const total = Math.max(0, toFiniteAmount(order?.total));
  const method = String(order?.paymentMethod || 'cash').toLowerCase();

  if (order?.paymentStatus === 'credit' || method === 'credit') {
    return { cash: 0, transfer: 0, credit: total, total };
  }

  if (method === 'split') {
    const storedCash = getStoredAmount(order?.cashReceived);
    const storedTransfer = getStoredAmount(order?.transferAmount);
    const cash = storedCash !== null
      ? clampAmount(storedCash, total)
      : storedTransfer !== null
        ? clampAmount(total - storedTransfer, total)
        : 0;

    return { cash, transfer: Math.max(0, total - cash), credit: 0, total };
  }

  if (['vietqr', 'qr', 'transfer', 'bank_transfer'].includes(method)) {
    return { cash: 0, transfer: total, credit: 0, total };
  }

  const received = getStoredAmount(order?.cashReceived) ?? total;
  const change = Math.max(0, toFiniteAmount(order?.changeAmount));
  const cash = clampAmount(received - change, total);
  return { cash, transfer: 0, credit: 0, total };
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [currentShift, setCurrentShift] = useState(null);
  const [loading, setLoading] = useState(true);

  const getOpenAttendance = async (userId) => {
    const openAttendances = await db.attendance
      .where('userId')
      .equals(userId)
      .filter(attendance => !attendance.clockOut)
      .toArray();

    return openAttendances.reduce((latest, attendance) => (
      !latest || attendance.clockIn > latest.clockIn ? attendance : latest
    ), null);
  };

  const clockOutUser = async (userId) => {
    const attendance = await getOpenAttendance(userId);
    if (!attendance) return;

    const clockOut = Date.now();
    const totalHours = Math.max(0, (clockOut - attendance.clockIn) / (1000 * 60 * 60));
    await db.attendance.update(attendance.id, { clockOut, totalHours });
  };

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
        if (user.mustChangePin) {
          return {
            success: false,
            requiresPinChange: true,
            user: { id: user.id, username: user.username, name: user.name }
          };
        }
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
        
        // Clock in using the store's local calendar date. An open record from a
        // previous date (for example, a shift crossing midnight) remains valid.
        const existingAttendance = await getOpenAttendance(user.id);
          
        if (!existingAttendance) {
          await db.attendance.add({
            userId: user.id,
            clockIn: Date.now(),
            clockOut: null,
            date: getLocalDateKey(),
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

  const changeRequiredPin = async (username, currentPin, newPin) => {
    if (!/^\d{4}$/.test(newPin)) {
      return { success: false, error: 'Mã PIN mới phải gồm đúng 4 chữ số' };
    }
    if (newPin === '0000' || newPin === currentPin) {
      return { success: false, error: 'Mã PIN mới phải khác mã mặc định/hiện tại' };
    }

    try {
      const user = await db.users.where('username').equals(username).first();
      if (!user?.isActive || !user.mustChangePin) {
        return { success: false, error: 'Yêu cầu đổi PIN không còn hợp lệ' };
      }

      const currentHash = await hashPin(currentPin);
      const legacyCurrentHash = await legacyHashPin(currentPin);
      if (user.pinHash !== currentHash && user.pinHash !== legacyCurrentHash) {
        return { success: false, error: 'Mã PIN hiện tại không đúng' };
      }

      await db.users.update(user.id, {
        pinHash: await hashPin(newPin),
        mustChangePin: false
      });
      return await login(username, newPin);
    } catch (err) {
      console.error('Required PIN change error:', err);
      return { success: false, error: 'Không thể đổi mã PIN lúc này' };
    }
  };

  const logout = async () => {
    try {
      if (currentUser) {
        // Find active attendance and clock out if no active shift
        if (!currentShift) {
          await clockOutUser(currentUser.id);
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
      const newShift = await db.transaction('rw', db.shifts, async () => {
        const existingShift = await db.shifts
          .where('userId')
          .equals(currentUser.id)
          .filter(shift => shift.status === 'active')
          .first();
        if (existingShift) return existingShift;

        const initialCash = Math.max(0, toFiniteAmount(startingCash));
        const shiftId = await db.shifts.add({
          userId: currentUser.id,
          startTime: Date.now(),
          endTime: null,
          startingCash: initialCash,
          expectedCash: initialCash,
          actualCash: 0,
          difference: 0,
          status: 'active'
        });
        return await db.shifts.get(shiftId);
      });

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
      const shiftResult = await db.transaction(
        'rw',
        [db.shifts, db.orders, db.customerTransactions],
        async () => {
          const liveShift = await db.shifts.get(currentShift.id);
          if (!liveShift || liveShift.status !== 'active') {
            throw new Error('Ca làm việc đã được kết thúc ở một cửa sổ khác.');
          }

          const shiftOrders = await db.orders
            .where('shiftId')
            .equals(liveShift.id)
            .toArray();
          const debtPayments = await db.customerTransactions
            .where('[shiftId+type]')
            .equals([liveShift.id, 'payment'])
            .filter(transaction => ['cash', 'transfer', 'vietqr'].includes(transaction.paymentMethod))
            .toArray();

          const paymentSummary = shiftOrders.reduce((summary, order) => {
            const breakdown = getOrderPaymentBreakdown(order);
            summary.cash += breakdown.cash;
            summary.transfer += breakdown.transfer;
            summary.credit += breakdown.credit;
            summary.total += breakdown.total;
            return summary;
          }, { cash: 0, transfer: 0, credit: 0, total: 0 });

          const collectionSummary = debtPayments.reduce((summary, transaction) => {
            const amount = Math.max(0, toFiniteAmount(transaction.amount));
            if (transaction.paymentMethod === 'cash') summary.cash += amount;
            else summary.transfer += amount;
            summary.total += amount;
            return summary;
          }, { cash: 0, transfer: 0, total: 0 });

          const countedCash = Math.max(0, toFiniteAmount(actualCash));
          const expectedCash = toFiniteAmount(liveShift.startingCash)
            + paymentSummary.cash
            + collectionSummary.cash;
          const difference = countedCash - expectedCash;
          const endTime = Date.now();
          const closedShift = {
            ...liveShift,
            endTime,
            expectedCash,
            actualCash: countedCash,
            difference,
            status: 'closed'
          };

          await db.shifts.update(liveShift.id, {
            endTime,
            expectedCash,
            actualCash: countedCash,
            difference,
            status: 'closed'
          });

          return {
            success: true,
            difference,
            expectedCash,
            paymentSummary,
            collectionSummary,
            shiftOrders,
            shift: closedShift
          };
        }
      );
      
      setCurrentShift(null);
      
      if (autoLogout) {
        try {
          if (currentUser) await clockOutUser(currentUser.id);
        } catch (attendanceError) {
          console.error("Error clocking out after ending shift:", attendanceError);
        }
        setCurrentUser(null);
        localStorage.removeItem('pos_current_user_id');
      }
      
      return shiftResult;
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
      changeRequiredPin,
      logout,
      startShift,
      endShift
    }}>
      {children}
    </AuthContext.Provider>
  );
};

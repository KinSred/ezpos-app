import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, UserPlus, Edit, Trash2, Shield, CheckCircle2, XCircle, Lock, KeyRound, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { hashPin } from '../../utils/security';

export default function StaffScreen() {
  const users = useLiveQuery(() => db.users.toArray(), []);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({
    username: '',
    name: '',
    role: 'cashier',
    pin: '',
    isActive: true
  });

  const handleOpenModal = (user = null) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        username: user.username,
        name: user.name,
        role: user.role,
        pin: '', // Don't show existing PIN
        isActive: user.isActive
      });
    } else {
      setEditingUser(null);
      setFormData({
        username: '',
        name: '',
        role: 'cashier',
        pin: '',
        isActive: true
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (editingUser) {
        // Update existing user
        const updateData = {
          username: formData.username,
          name: formData.name,
          role: formData.role,
          isActive: formData.isActive
        };
        
        // Only update PIN if provided
        if (formData.pin) {
          if (formData.pin.length !== 4) {
            toast.error("Mã PIN phải gồm 4 chữ số");
            return;
          }
          updateData.pinHash = await hashPin(formData.pin);
        }
        
        await db.users.update(editingUser.id, updateData);
        toast.success("Cập nhật nhân viên thành công");
      } else {
        // Create new user
        if (!formData.pin || formData.pin.length !== 4) {
          toast.error("Vui lòng nhập mã PIN 4 chữ số");
          return;
        }
        
        const existingUser = await db.users.where('username').equals(formData.username).first();
        if (existingUser) {
          toast.error("Tên đăng nhập đã tồn tại");
          return;
        }
        
        const pinHash = await hashPin(formData.pin);
        
        await db.users.add({
          username: formData.username,
          name: formData.name,
          role: formData.role,
          pinHash,
          isActive: formData.isActive
        });
        
        toast.success("Thêm nhân viên thành công");
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Có lỗi xảy ra");
    }
  };

  const handleDelete = async (user) => {
    if (user.role === 'admin' && users.filter(u => u.role === 'admin').length <= 1) {
      toast.error("Không thể xóa Admin duy nhất của hệ thống");
      return;
    }
    
    if (confirm(`Bạn có chắc muốn xóa nhân viên ${user.name}?`)) {
      await db.users.delete(user.id);
      toast.success("Đã xóa nhân viên");
    }
  };

  return (
    <div className="h-full bg-transparent p-6 overflow-y-auto transition-colors duration-200">
      <div className="max-w-5xl mx-auto mt-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <h1 className="text-3xl font-bold text-sky-950 dark:text-white tracking-tight flex items-center gap-3">
            <Users className="text-indigo-600 dark:text-indigo-400" size={32} />
            Quản Lý Nhân Viên
          </h1>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-600/30 transition-all border border-white/20 backdrop-blur-sm"
          >
            <UserPlus size={18} />
            Thêm Nhân Viên
          </motion.button>
        </div>

        <div className="glass-card rounded-3xl overflow-hidden transition-colors duration-500">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-widest bg-white/40 dark:bg-[#0a0d1a]/50 backdrop-blur-md border-b border-black/5 dark:border-white/5">
                <th className="p-4">Tên Nhân Viên</th>
                <th className="p-4">Tên Đăng Nhập</th>
                <th className="p-4">Vai Trò</th>
                <th className="p-4 text-center">Trạng Thái</th>
                <th className="p-4 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/5">
              {users?.map(user => (
                <tr key={user.id} className="border-b border-black/5 dark:border-white/5 hover:bg-white/15 dark:hover:bg-white/5 transition-all duration-200">
                  <td className="p-4 font-bold text-slate-800 dark:text-slate-100">{user.name}</td>
                  <td className="p-4 text-slate-600 dark:text-slate-350">@{user.username}</td>
                  <td className="p-4">
                    <span className={
                      user.role === 'admin' 
                        ? 'glass-badge-rose' 
                        : 'glass-badge-sky'
                    }>
                      {user.role === 'admin' ? 'Quản Lý' : 'Thu Ngân'}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    {user.isActive ? (
                      <span className="glass-badge-emerald inline-flex items-center gap-1">
                        <CheckCircle2 size={12} />
                        Hoạt Động
                      </span>
                    ) : (
                      <span className="glass-badge-rose inline-flex items-center gap-1">
                        <XCircle size={12} />
                        Đã Khóa
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-right space-x-2">
                    <button
                      onClick={() => handleOpenModal(user)}
                      className="p-2 glass-button text-slate-400 hover:text-indigo-650 dark:hover:text-indigo-400 rounded-xl transition-colors"
                      title="Sửa nhân viên"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(user)}
                      className="p-2 glass-button text-slate-400 hover:text-rose-500 rounded-xl transition-colors"
                      title="Xóa nhân viên"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {users?.length === 0 && (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-slate-500">Chưa có nhân viên nào.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="glass-card rounded-3xl w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-slate-800 dark:text-white">
                    {editingUser ? 'Cập Nhật Nhân Viên' : 'Thêm Nhân Viên Mới'}
                  </h2>
                  <button 
                    onClick={() => setIsModalOpen(false)}
                    className="p-2 glass-button text-slate-400 hover:text-slate-600 rounded-full"
                  >
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Tên Hiển Thị</label>
                    <input
                      required
                      type="text"
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      className="w-full px-4 py-2.5 glass-input rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="VD: Nguyễn Văn A"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Tên Đăng Nhập</label>
                    <input
                      type="text"
                      required
                      disabled={!!editingUser}
                      value={formData.username}
                      onChange={e => setFormData({...formData, username: e.target.value})}
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono disabled:opacity-50"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Mã PIN (4 số)</label>
                    <input
                      required={!editingUser}
                      type="text"
                      pattern="[0-9]*"
                      maxLength="4"
                      value={formData.pin}
                      onChange={e => setFormData({...formData, pin: e.target.value.replace(/[^0-9]/g, '')})}
                      className="w-full px-4 py-2.5 glass-input rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center tracking-[1em] font-mono text-lg"
                      placeholder="••••"
                    />
                    {editingUser && <p className="text-xs text-slate-500 mt-1">Bỏ trống nếu không muốn đổi mã PIN</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Vai Trò</label>
                    <select
                      value={formData.role}
                      onChange={e => setFormData({...formData, role: e.target.value})}
                      className="w-full px-4 py-2.5 glass-input rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
                    >
                      <option value="cashier" className="dark:bg-slate-800">Nhân Viên Thu Ngân</option>
                      <option value="admin" className="dark:bg-slate-800">Quản Lý</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="checkbox"
                      id="isActive"
                      checked={formData.isActive}
                      onChange={e => setFormData({...formData, isActive: e.target.checked})}
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300"
                    />
                    <label htmlFor="isActive" className="text-sm font-bold text-slate-700 dark:text-slate-300">
                      Tài khoản đang hoạt động
                    </label>
                  </div>

                  <div className="flex gap-3 pt-4 border-t border-slate-200/20 dark:border-slate-700/20">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="flex-1 px-4 py-3 glass-button text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-colors"
                    >
                      Hủy Bỏ
                    </button>
                    <button
                      type="submit"
                      className="flex-1 px-4 py-3 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/30 transition-all border border-white/20 backdrop-blur-sm"
                    >
                      {editingUser ? 'Cập Nhật' : 'Thêm Mới'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

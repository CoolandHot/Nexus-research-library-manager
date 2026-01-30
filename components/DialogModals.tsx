
import React from 'react';
import { AlertTriangle, CheckCircle, Info, X } from 'lucide-react';

interface ConfirmDialogProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel: () => void;
    variant?: 'danger' | 'warning' | 'info';
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    isOpen,
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    onConfirm,
    onCancel,
    variant = 'warning'
}) => {
    if (!isOpen) return null;

    const variantStyles = {
        danger: {
            icon: <AlertTriangle size={32} />,
            iconBg: 'bg-red-100',
            iconColor: 'text-red-600',
            confirmBg: 'bg-red-600 hover:bg-red-700 shadow-red-100'
        },
        warning: {
            icon: <AlertTriangle size={32} />,
            iconBg: 'bg-yellow-100',
            iconColor: 'text-yellow-600',
            confirmBg: 'bg-yellow-600 hover:bg-yellow-700 shadow-yellow-100'
        },
        info: {
            icon: <Info size={32} />,
            iconBg: 'bg-blue-100',
            iconColor: 'text-blue-600',
            confirmBg: 'bg-blue-600 hover:bg-blue-700 shadow-blue-100'
        }
    };

    const styles = variantStyles[variant];

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onCancel}></div>
            <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl relative z-10 p-8 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex flex-col items-center text-center">
                    <div className={`p-4 ${styles.iconBg} ${styles.iconColor} rounded-2xl mb-4`}>
                        {styles.icon}
                    </div>
                    <h2 className="text-2xl font-black text-slate-900 mb-3">{title}</h2>
                    <p className="text-slate-600 mb-8 leading-relaxed">{message}</p>
                    <div className="flex w-full space-x-3">
                        <button
                            onClick={onCancel}
                            className="flex-1 px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-black uppercase tracking-widest text-xs transition-all"
                        >
                            {cancelText}
                        </button>
                        <button
                            onClick={() => {
                                onConfirm();
                                onCancel();
                            }}
                            className={`flex-1 px-6 py-3 text-white rounded-xl font-black uppercase tracking-widest text-xs transition-all shadow-lg ${styles.confirmBg}`}
                        >
                            {confirmText}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

interface AlertDialogProps {
    isOpen: boolean;
    title: string;
    message: string;
    onClose: () => void;
    variant?: 'success' | 'error' | 'info';
}

export const AlertDialog: React.FC<AlertDialogProps> = ({
    isOpen,
    title,
    message,
    onClose,
    variant = 'info'
}) => {
    if (!isOpen) return null;

    const variantStyles = {
        success: {
            icon: <CheckCircle size={32} />,
            iconBg: 'bg-green-100',
            iconColor: 'text-green-600',
            buttonBg: 'bg-green-600 hover:bg-green-700 shadow-green-100'
        },
        error: {
            icon: <AlertTriangle size={32} />,
            iconBg: 'bg-red-100',
            iconColor: 'text-red-600',
            buttonBg: 'bg-red-600 hover:bg-red-700 shadow-red-100'
        },
        info: {
            icon: <Info size={32} />,
            iconBg: 'bg-blue-100',
            iconColor: 'text-blue-600',
            buttonBg: 'bg-blue-600 hover:bg-blue-700 shadow-blue-100'
        }
    };

    const styles = variantStyles[variant];

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>
            <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl relative z-10 p-8 animate-in fade-in zoom-in-95 duration-200">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors p-2 hover:bg-slate-50 rounded-xl"
                >
                    <X size={20} />
                </button>
                <div className="flex flex-col items-center text-center">
                    <div className={`p-4 ${styles.iconBg} ${styles.iconColor} rounded-2xl mb-4`}>
                        {styles.icon}
                    </div>
                    <h2 className="text-2xl font-black text-slate-900 mb-3">{title}</h2>
                    <p className="text-slate-600 mb-8 leading-relaxed whitespace-pre-wrap">{message}</p>
                    <button
                        onClick={onClose}
                        className={`px-8 py-3 text-white rounded-xl font-black uppercase tracking-widest text-xs transition-all shadow-lg ${styles.buttonBg}`}
                    >
                        Got it
                    </button>
                </div>
            </div>
        </div>
    );
};

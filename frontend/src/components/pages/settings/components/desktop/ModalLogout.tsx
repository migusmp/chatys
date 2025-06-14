import styles from '../../css/AccountSettings.module.css';

interface ModalLogoutProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
}

export default function ModalLogout({
  message,
  onConfirm,
  onCancel,
  confirmText = "Yes",
  cancelText = "No",
}: ModalLogoutProps) {
  return (
    <div className={styles.modalBackdrop}>
      <div className={styles.modal}>
        <p>{message}</p>
        <div className={styles.modalButtons}>
          <button onClick={onConfirm} className={styles.confirmBtn}>
            {confirmText}
          </button>
          <button onClick={onCancel} className={styles.cancelBtn}>
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  );
}

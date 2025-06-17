// src/components/ui/BackButton.tsx
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import styles from '../css/PostsProfileSection.module.css';

type BackButtonProps = {
  name?: string;
};

export default function BackButton({ name }: BackButtonProps) {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      if (window.innerWidth <= 768) {
        setVisible(currentScrollY < lastScrollY);
        setLastScrollY(currentScrollY);
      } else {
        setVisible(true);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  return (
    <div className={`${styles.backButtonContainer} ${visible ? styles.visible : styles.hidden}`}>
      <div className={styles.backButtonInner}>
        <button className={styles.backButton} onClick={() => navigate(-1)}>
          <i className="bi bi-arrow-left" style={{ fontSize: '1.2rem'}}></i> <strong style={{ fontWeight: 'bold'}}>{ name ? ` ${name}` : '' }</strong>
        </button>
      </div>
    </div>
  );
}

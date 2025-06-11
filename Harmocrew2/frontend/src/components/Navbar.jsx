import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from '../styles/Navbar.module.css'; 

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleAnunciarClick = () => {
    navigate('/home?showNewPostModal=true');
  };

  return (
    <nav className={styles.navbar}>
      <Link to="/home" className={styles.logo}>
        <span className={styles.logoIcon}>♫</span> HarmoCrew
      </Link>

      <div className={styles.navRight}>
        <ul className={styles.mainNavList}>
          <li><Link to="/candidaturas" className={styles.navButtonStyled}>Candidaturas</Link></li>
          <li><Link to="/home" className={styles.navButtonStyled}>Página Inicial</Link></li>
          <li>
            <button onClick={handleAnunciarClick} className={styles.navButtonStyledAnunciar}>Anunciar</button>
          </li>
        </ul>

        {user ? (
          <div className={styles.userSection}>
            <Link to="/profile" className={styles.profileIconLink}>
              <img
                src={user.profile_pic_url || `https://i.pravatar.cc/30?u=${user.id}`}
                alt="Perfil"
                className={styles.profileNavPhoto}
              />
            </Link>
            <span className={styles.userNameDisplay}>{user.nome}</span>
            <button onClick={handleLogout} className={styles.logoutButton}>Logout</button>
          </div>
        ) : (
          <div className={styles.userSection}>
             <Link to="/login" className={styles.navButtonStyled}>Login</Link>
             <Link to="/register" className={styles.navButtonStyledAnunciar}>Cadastre-se</Link>
          </div>
        )}
      </div>
    </nav>
  );
}
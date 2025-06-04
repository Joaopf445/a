// frontend/src/components/Layout.jsx
import React from "react";
import { useLocation } from "react-router-dom";
import Navbar from "./Navbar"; // Certifique-se que o caminho está correto
import "../styles/global.css"; //
import "../styles/colors.css"; //

export default function Layout({ children }) {
  const location = useLocation();
  // Define os caminhos onde a Navbar não deve aparecer (páginas de login/registro)
  const hideNavbarOnPaths = ['/', '/login', '/register'];

  const shouldHideNavbar = hideNavbarOnPaths.includes(location.pathname);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: 'var(--primary-dark)', // Fundo escuro para a página toda
    }}>
      {!shouldHideNavbar && <Navbar />}
      <div style={{ 
        flexGrow: 1, 
        display: 'flex', 
        flexDirection: 'column',
        width: '100%' // Garante que o conteúdo ocupe a largura
      }}>
        {children}
      </div>
    </div>
  );
}
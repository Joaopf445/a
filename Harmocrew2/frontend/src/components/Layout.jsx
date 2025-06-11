import React from "react";
import { useLocation } from "react-router-dom";
import Navbar from "./Navbar";
import "../styles/global.css";
import "../styles/colors.css";

export default function Layout({ children }) {
  const location = useLocation();
  const hideNavbarOnPaths = ['/', '/login', '/register'];

  const shouldHideNavbar = hideNavbarOnPaths.includes(location.pathname);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: 'var(--primary-dark)',
    }}>
      {!shouldHideNavbar && <Navbar />}
      <div style={{ 
        flexGrow: 1, 
        display: 'flex', 
        flexDirection: 'column',
        width: '100%'
      }}>
        {children}
      </div>
    </div>
  );
}
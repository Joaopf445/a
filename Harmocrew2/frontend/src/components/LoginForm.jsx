import React from "react";
import { Link } from "react-router-dom";
import styles from "../styles/LoginForm.module.css";
import "../styles/global.css";
import "../styles/colors.css";

const LoginForm = ({ email, senha, setEmail, setSenha, onSubmit, errorMessage }) => {
  return (
    <div className={styles.loginPageContainer}>
      <div className={styles.leftPanel}>
        <div className={styles.logoContainer}>
          <span className={styles.logoIcon}>♫</span>
          <h1 className={styles.logoText}>HarmoCrew</h1>
        </div>
        <p className={styles.tagline}>
          O HarmoCrew ajuda você a se conectar com outros músicos e criar projetos musicais juntos.
        </p>
      </div>

      <div className={styles.rightPanel}>
        <div className={styles.card}>
          <div className={styles.title}>Entrar</div>

          <input
            type="text"
            placeholder="Email ou Telefone"
            className={styles.input}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          
          <input
            type="password"
            placeholder="Senha"
            className={styles.input}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />

          {errorMessage && (
            <div className={styles.errorMessage}>{errorMessage}</div>
          )}

          <button onClick={onSubmit} className={styles.button}>
            Entrar
          </button>

          <div className={styles.linksContainer}>
            <Link to="/esqueceu-senha" className={styles.forgotPasswordLink}> 
              Esqueceu a senha?
            </Link>
          </div>

          <div className={styles.registerSection}>
            Não tem uma conta? <Link to="/register">Cadastre-se</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;
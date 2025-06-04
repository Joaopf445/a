import React from "react";
import { Link } from "react-router-dom";
import styles from "../styles/LoginForm.module.css";
import "../styles/global.css";
import "../styles/colors.css";

const LoginForm = ({ email, senha, setEmail, setSenha, onSubmit, errorMessage }) => {
  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.title}>HarmoCrew Login</div>

        <input
          type="text"
          placeholder="Email"
          className={styles.input}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {errorMessage && (
          <div className={styles.errorMessage}>{errorMessage}</div>
        )}

        <input
          type="password"
          placeholder="Senha"
          className={styles.input}
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />

        <button onClick={onSubmit} className={styles.button}>
          Entrar
        </button>
        <div className={styles["register-section"]}>
          Novo por aqui? <Link to="/register">Crie uma conta</Link>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;

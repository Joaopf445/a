import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import LoginForm from "../components/LoginForm";
import "../styles/global.css";
import "../styles/colors.css";

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async () => {
    setErrorMessage(""); 
    try {
      const res = await fetch("http://localhost:5000/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, senha }),
      });

      const data = await res.json();
      if (res.ok) {
        login(data.token, data.user);
        navigate("/home");
      } else {
        setErrorMessage(data.message || "Credenciais inválidas!");
      }
    } catch (error) {
      setErrorMessage("Erro ao tentar fazer login. Tente novamente mais tarde.");
      console.error(error);
    }
  };

  return (
    <LoginForm
      email={email}
      senha={senha}
      setEmail={setEmail}
      setSenha={setSenha}
      onSubmit={handleLogin}
      errorMessage={errorMessage}
    />
  );
};

export default LoginPage;

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import styles from "../styles/RegisterForm.module.css";
import "../styles/global.css";
import "../styles/colors.css";

const RegisterForm = () => {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmSenha, setConfirmSenha] = useState("");

  const [errors, setErrors] = useState({});
  const navigate = useNavigate();

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const senhaRegex = {
    length: /.{8,}/,
    uppercase: /[A-Z]/,
    lowercase: /[a-z]/,
    number: /\d/,
    symbol: /[!@#$%^&*(),.?":{}|<>]/,
  };

  const validateFields = () => {
    const newErrors = {};

    if (!nome.trim()) newErrors.nome = "Nome é obrigatório.";
    else if (nome.trim().length < 3) newErrors.nome = "Nome deve ter pelo menos 3 caracteres.";

    if (!email.trim()) newErrors.email = "Email é obrigatório.";
    else if (!emailRegex.test(email)) newErrors.email = "Formato de email inválido.";

    if (!senha) newErrors.senha = "Senha é obrigatória.";
    else {
      if (!senhaRegex.length.test(senha)) newErrors.senha = "Senha deve ter pelo menos 8 caracteres.";
      else if (!senhaRegex.uppercase.test(senha)) newErrors.senha = "Senha deve conter ao menos uma letra maiúscula.";
      else if (!senhaRegex.lowercase.test(senha)) newErrors.senha = "Senha deve conter ao menos uma letra minúscula.";
      else if (!senhaRegex.number.test(senha)) newErrors.senha = "Senha deve conter ao menos um número.";
      else if (!senhaRegex.symbol.test(senha)) newErrors.senha = "Senha deve conter ao menos um símbolo (ex: !@#$%).";
    }

    if (!confirmSenha) newErrors.confirmSenha = "Confirmação de senha é obrigatória.";
    else if (senha !== confirmSenha) newErrors.confirmSenha = "As senhas não coincidem.";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    if (!validateFields()) return;

    try {
      const res = await fetch("http://localhost:5000/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, email, senha }),
      });

      const data = await res.json();

      if (res.ok) {
        alert("Cadastro realizado com sucesso!");
        navigate("/");
      } else {
        setErrors({ backend: data.message || "Erro ao cadastrar. Tente novamente." });
      }
    } catch (error) {
      setErrors({ backend: "Erro na comunicação com o servidor. Tente mais tarde." });
      console.error(error);
    }
  };

  const checkRule = (regex) => regex.test(senha);

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.title}>Criar Conta</div>

        <input
          type="text"
          placeholder="Nome completo"
          className={styles.input}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          aria-describedby="nome-error"
        />
        {errors.nome && <div id="nome-error" className={styles.error}>{errors.nome}</div>}

        <input
          type="email"
          placeholder="Email"
          className={styles.input}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-describedby="email-error"
        />
        {errors.email && <div id="email-error" className={styles.error}>{errors.email}</div>}

        <div className={styles.tooltipWrapper}>
          <input
            type="password"
            placeholder="Senha"
            className={styles.input}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            aria-describedby="senha-error"
          />
          <div className={styles.tooltipIcon}>?</div>
          <div className={styles.tooltipContent}>
            <ul>
              <li className={checkRule(senhaRegex.length) ? styles.valid : ""}>
                {checkRule(senhaRegex.length) ? "✔️" : "❌"} Pelo menos 8 caracteres
              </li>
              <li className={checkRule(senhaRegex.uppercase) ? styles.valid : ""}>
                {checkRule(senhaRegex.uppercase) ? "✔️" : "❌"} Uma letra maiúscula
              </li>
              <li className={checkRule(senhaRegex.lowercase) ? styles.valid : ""}>
                {checkRule(senhaRegex.lowercase) ? "✔️" : "❌"} Uma letra minúscula
              </li>
              <li className={checkRule(senhaRegex.number) ? styles.valid : ""}>
                {checkRule(senhaRegex.number) ? "✔️" : "❌"} Um número
              </li>
              <li className={checkRule(senhaRegex.symbol) ? styles.valid : ""}>
                {checkRule(senhaRegex.symbol) ? "✔️" : "❌"} Um símbolo (!@#$%)
              </li>
            </ul>
          </div>
        </div>
        {errors.senha && <div id="senha-error" className={styles.error}>{errors.senha}</div>}

        <input
          type="password"
          placeholder="Confirmar senha"
          className={styles.input}
          value={confirmSenha}
          onChange={(e) => setConfirmSenha(e.target.value)}
          aria-describedby="confirmSenha-error"
        />
        {errors.confirmSenha && <div id="confirmSenha-error" className={styles.error}>{errors.confirmSenha}</div>}

        <button onClick={handleRegister} className={styles.button}>Registrar</button>

        {errors.backend && <div className={styles.error} style={{ marginTop: "10px" }}>{errors.backend}</div>}

        <div className={styles.loginSection}>
          Já tem uma conta? <Link to="/"> Faça login</Link>
        </div>
      </div>
    </div>
  );
};

export default RegisterForm;

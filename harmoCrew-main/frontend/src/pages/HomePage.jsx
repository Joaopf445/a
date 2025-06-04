import React, { useEffect, useState } from "react";
import styles from "../styles/HomePage.module.css";
import { useAuth } from "../context/AuthContext";
import { Link, useLocation, useNavigate } from "react-router-dom";

const HomePage = () => {
  const { token, user, logout } = useAuth();
  const [posts, setPosts] = useState([]);
  
  // Estados para o novo post
  const [newPostTitle, setNewPostTitle] = useState(""); // NOVO ESTADO: Título
  const [newPostText, setNewPostText] = useState("");   // Descrição (já existia)
  const [newPostAudioUrl, setNewPostAudioUrl] = useState(""); // NOVO ESTADO: URL do Áudio

  const [loading, setLoading] = useState(false); 
  const [loadingCreate, setLoadingCreate] = useState(false); 
  const [showNewPostModal, setShowNewPostModal] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [followedArtists, setFollowedArtists] = useState([]);

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    if (queryParams.get('showNewPostModal') === 'true') {
      setShowNewPostModal(true);
      navigate(location.pathname, { replace: true }); 
    }
  }, [location, navigate]);

  useEffect(() => {
    const fetchPosts = async () => {
      if (!token) return;
      setLoading(true); 
      try {
        const res = await fetch("http://localhost:5000/posts", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok) {
          const postsWithPics = (data.posts || []).map(p => ({
            ...p,
            profile_pic_url: p.profile_pic_url || `https://i.pravatar.cc/50?u=${p.user_id}`
          }));
          setPosts(postsWithPics);
        } else {
          console.error("Erro ao carregar posts:", data.message);
          if (res.status === 401) logout();
        }
      } catch (err) {
        console.error("Erro de conexão com o servidor ao carregar posts:", err);
      }
      setLoading(false); 
    };
    fetchPosts();
  }, [token, logout]);

  useEffect(() => {
    if (token && user) {
      const fetchFollowedArtists = async () => {
        try {
          const res = await fetch(`http://localhost:5000/api/me/following`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await res.json();
          if (res.ok) {
            setFollowedArtists(data.following || []);
          } else {
            console.error("Erro ao buscar artistas seguidos:", data.message);
            setFollowedArtists([]); 
          }
        } catch (err) {
          console.error("Erro de conexão ao buscar artistas seguidos:", err);
          setFollowedArtists([]);
        }
      };
      fetchFollowedArtists();
    }
  }, [token, user, location]);

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (searchTerm.trim() && token) {
        fetch(`http://localhost:5000/search_users?q=${encodeURIComponent(searchTerm)}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then((res) => res.json())
          .then((data) => {
            const usersWithPics = (data.users || []).map(u => ({
                ...u,
                profile_pic_url: u.profile_pic_url || `https://i.pravatar.cc/30?u=${u.id}`
            }));
            setSearchResults(usersWithPics);
          })
          .catch(() => setSearchResults([]));
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchTerm, token]);

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!newPostTitle.trim()) { // Título agora é obrigatório
      alert("O título do projeto é obrigatório!");
      return;
    }
    if (!newPostText.trim()) {
      alert("A descrição do projeto é obrigatória!");
      return;
    }
    setLoadingCreate(true);
    try {
      const postData = {
        titulo: newPostTitle,
        texto: newPostText,
        audio_url: newPostAudioUrl.trim() || null, // Envia null se vazio
      };

      const res = await fetch("http://localhost:5000/posts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(postData),
      });
      const data = await res.json();
      if (res.ok) {
        const newPost = {
            ...data.post, // O backend já deve retornar o post completo
            nome: user.nome, 
            profile_pic_url: user.profile_pic_url || `https://i.pravatar.cc/50?u=${user.id}`,
            user_id: user.id 
        };
        setPosts([newPost, ...posts]);
        setNewPostTitle(""); // Limpa os campos do formulário
        setNewPostText("");
        setNewPostAudioUrl("");
        setShowNewPostModal(false);
      } else {
        alert(data.message || "Erro ao criar post.");
        if (res.status === 401) logout();
      }
    } catch (err) {
      alert("Erro de conexão com o servidor ao criar post.");
    }
    setLoadingCreate(false);
  };

  const handleCandidatar = async (postId) => {
    // ... (função handleCandidatar existente) ...
    if (!token) {
      alert("Você precisa estar logado para se candidatar.");
      navigate('/login');
      return;
    }
    try {
      const res = await fetch(`http://localhost:5000/candidatar/${postId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      alert(data.message || "Candidatura enviada!");
    } catch (err) {
      alert("Erro ao se candidatar.");
    }
  };

  return (
    <div className={styles.wrapper}>
      {/* Sidebar Esquerda (Busca e Você Segue) */}
      <aside className={styles.sidebarLeft}>
        {/* ... (código da sidebarLeft existente) ... */}
        <h3 className={styles.sidebarTitle}>Pesquisar</h3>
        <input
          className={styles.search}
          type="text"
          placeholder="Pesquisar artistas..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        {searchResults.length > 0 && (
          <div className={styles.searchResults}>
            {searchResults.map((foundUser) => (
              <Link
                key={foundUser.id}
                to={`/usuario/${foundUser.id}`}
                className={styles.searchResultItem}
              >
                <img 
                  src={foundUser.profile_pic_url} 
                  alt={foundUser.nome} 
                  className={styles.searchResultPhoto} 
                />
                <div className={styles.searchResultInfo}>
                  <strong>{foundUser.nome}</strong>
                  <small>{foundUser.email}</small>
                </div>
              </Link>
            ))}
          </div>
        )}

        {!searchTerm && (
          <>
            <h3 className={`${styles.sidebarTitle} ${styles.youFollowTitle}`}>Você Segue</h3>
            <ul className={styles.youFollowList}>
              {followedArtists.length > 0 ? (
                followedArtists.map((artist) => (
                  <li key={artist.id}>
                    <Link 
                      to={`/usuario/${artist.id}`} 
                      className={styles.youFollowItem}
                    >
                      <img
                        src={artist.profile_pic_url} 
                        alt={artist.nome}
                        className={styles.followUserPhoto}
                      />
                      <span>{artist.nome}</span>
                    </Link>
                  </li>
                ))
              ) : (
                <li className={styles.emptyFollowList}>
                  <p>Você ainda não segue ninguém.</p>
                </li>
              )}
            </ul>
          </>
        )}
      </aside>

      {/* Feed Central */}
      <main className={styles.feed}>
        {loading && posts.length === 0 && <p>Carregando posts...</p>}
        {!loading && posts.length === 0 && <p>Nenhum post disponível no momento.</p>}
        
        {posts.map((post) => (
          <div key={post.id} className={styles.postCard}>
            <div className={styles.postHeader}>
              <Link 
                to={`/usuario/${post.user_id}`} 
                className={styles.postCreatorLink}
              >
                <img
                  src={post.profile_pic_url}
                  alt={post.nome}
                  className={styles.postUserPhoto}
                />
                <span className={styles.postUserName}>{post.nome}</span>
              </Link>
            </div>

            {/* NOVO: Título do Post */}
            {post.titulo && <h4 className={styles.postTitle}>{post.titulo}</h4>}
            
            <div className={styles.postContentMain}>
              <p className={styles.postDescription}>{post.texto}</p>
              
              {/* NOVO: Player de Áudio se URL existir */}
              {post.audio_url && (
                <div className={styles.audioPlayerContainer}>
                  <audio controls src={post.audio_url} className={styles.audioPlayer}>
                    Seu navegador não suporta o elemento de áudio.
                  </audio>
                </div>
              )}

              {/* O footer antigo com play/progress bar foi removido para dar lugar ao <audio controls> */}
              <div className={styles.postFooterSimple}> {/* Renomeado para evitar conflito */}
                <small className={styles.postDate}>
                  {new Date(post.created_at || post.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </small>
              </div>
            </div>
            {user && post.user_id !== user.id && (
              <button
                className={styles.candidatarButton}
                onClick={(e) => {
                  e.stopPropagation();
                  handleCandidatar(post.id);
                }}
              >
                Candidatar-se
              </button>
            )}
          </div>
        ))}
      </main>

      {/* Modal de Criar Novo Projeto (Anunciar) */}
      {showNewPostModal && (
        <div className={styles.overlay} onClick={() => setShowNewPostModal(false)}>
          <div className={styles.modalAnunciar} onClick={(e) => e.stopPropagation()}> {/* Nova classe para estilização específica */}
            <h3>Novo Projeto Musical</h3>
            <form onSubmit={handleCreatePost} className={styles.anunciarForm}>
              <div className={styles.formGroup}>
                <label htmlFor="postTitulo">Título do Projeto</label>
                <input
                  type="text"
                  id="postTitulo"
                  placeholder="Ex: Faixa de Lo-fi para estudos"
                  value={newPostTitle}
                  onChange={(e) => setNewPostTitle(e.target.value)}
                  className={styles.inputField}
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="postDescricao">Descrição</label>
                <textarea
                  id="postDescricao"
                  placeholder="Descreva sua ideia, o que você procura, etc."
                  value={newPostText}
                  onChange={(e) => setNewPostText(e.target.value)}
                  rows={5}
                  className={styles.textareaField}
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="postAudioUrl">Adicione sua faixa de áudio (URL)</label>
                <input
                  type="text" // MUDADO para text para URL. Para upload real, seria type="file"
                  id="postAudioUrl"
                  placeholder="https://... (link direto para o arquivo de áudio)"
                  value={newPostAudioUrl}
                  onChange={(e) => setNewPostAudioUrl(e.target.value)}
                  className={styles.inputField}
                />
                {/* Para upload de arquivo real (mais complexo, para o futuro):
                <input 
                  type="file" 
                  id="postAudioFile" 
                  accept="audio/*" 
                  className={styles.inputFile} 
                  // onChange={handleFileChange} 
                /> 
                */}
              </div>
              <div className={styles.modalActionsAnunciar}>
                <button
                  type="button"
                  className={`${styles.buttonAnunciar} ${styles.cancelButtonAnunciar}`}
                  onClick={() => setShowNewPostModal(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={`${styles.buttonAnunciar} ${styles.publishButtonAnunciar}`}
                  disabled={loadingCreate}
                >
                  {loadingCreate ? "Postando..." : "Postar Projeto"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomePage;
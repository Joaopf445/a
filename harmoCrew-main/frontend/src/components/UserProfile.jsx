import React, { useEffect, useState, useCallback } from 'react';
import styles from '../styles/ProfilePage.module.css';
import { useParams, Link, useNavigate } from 'react-router-dom';
import "../styles/global.css";
import "../styles/colors.css";

const MusicIcon = () => <span style={{ marginRight: '8px' }}>🎵</span>;
const PeopleIcon = () => <span style={{ marginRight: '8px' }}>👥</span>;

export default function UserProfile() {
  const { id: profileIdFromParams } = useParams();
  const [profileUser, setProfileUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [friends, setFriends] = useState([]);
  const [activeTab, setActiveTab] = useState('projetos');
  
  const [loggedUserId, setLoggedUserId] = useState(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      return;
    }

    fetch('http://localhost:5000/profile', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok && res.status === 401) {
          localStorage.removeItem('token');
          return null;
        }
        return res.json();
      })
      .then(data => {
        if (data && data.user) {
          setLoggedUserId(data.user.id);
        }
      })
      .catch(err => console.error("Erro ao buscar usuário logado:", err));
  }, [navigate]);

  const fetchProfileAndFollowingStatus = useCallback(async () => {
    if (!profileIdFromParams) return;
    setLoading(true);
    const token = localStorage.getItem('token');

    try {
      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch(`http://localhost:5000/user/${profileIdFromParams}`, { headers });
      
      if (!res.ok) {
        throw new Error(`Falha ao buscar perfil do usuário (status ${res.status})`);
      }
      const data = await res.json();
      if (data.user) {
        setProfileUser(data.user);
        if (typeof data.user.is_following !== 'undefined') {
          setIsFollowing(data.user.is_following);
        }
      } else {
        setProfileUser(null);
      }
    } catch (err) {
      console.error("Erro ao buscar dados do perfil:", err);
      setProfileUser(null);
    } finally {
      setLoading(false);
    }
  }, [profileIdFromParams, loggedUserId]);

  const fetchProjects = useCallback(async () => {
    if (!profileUser) return;
    const token = localStorage.getItem('token');
    const headers = {};
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        const res = await fetch(`http://localhost:5000/user/${profileUser.id}/posts`, { headers });
        if (res.ok) {
            const dataPosts = await res.json();
            setProjects(dataPosts.posts || []);
        } else {
            console.error("Falha ao buscar projetos do usuário");
            setProjects([]);
        }
    } catch (error) {
        console.error("Erro de conexão ao buscar projetos:", error);
        setProjects([]);
    }
  }, [profileUser]);

  const fetchFriendsAndCheckFollowing = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token || !profileUser || !loggedUserId) {
      if (profileUser) {
        try {
            const res = await fetch(`http://localhost:5000/user/${profileUser.id}/followers`);
            if(res.ok) {
                const data = await res.json();
                setFriends(data.followers || []);
            } else { setFriends([]); }
        } catch(e) { console.error("Erro ao buscar amigos (sem token):", e); setFriends([]);}
      }
      return;
    }

    try {
        const res = await fetch(`http://localhost:5000/user/${profileUser.id}/followers`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
            const data = await res.json();
            setFriends(data.followers || []);

            if (profileUser && loggedUserId && data.followers) {
              if (typeof profileUser.is_following === 'undefined') {
                  const isNowFollowing = data.followers.some(f => f.id === loggedUserId);
                  setIsFollowing(isNowFollowing);
              }
            }
        } else {
            setFriends([]);
        }
    } catch (err) {
        console.error("Erro ao buscar amigos:", err);
        setFriends([]);
    }
  }, [profileUser, loggedUserId]);

  useEffect(() => {
    fetchProfileAndFollowingStatus();
  }, [fetchProfileAndFollowingStatus]);

  useEffect(() => {
    if (profileUser) {
      fetchProjects();
      fetchFriendsAndCheckFollowing();
    }
  }, [profileUser, fetchProjects, fetchFriendsAndCheckFollowing]);

  const handleFollow = async () => {
    const token = localStorage.getItem('token');
    if (!token || !profileUser || profileUser.id === loggedUserId) {
      alert("Você precisa estar logado para seguir usuários.");
      return;
    }
    
    const action = isFollowing ? 'unfollow' : 'follow';

    try {
        const res = await fetch(`http://localhost:5000/${action}/${profileUser.id}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok) {
          alert(data.message || `Operação de ${action} bem-sucedida!`);
          setIsFollowing(!isFollowing);
          fetchFriendsAndCheckFollowing();
        } else {
          alert(data.message || `Erro ao ${action}.`);
        }
    } catch (err) {
        console.error(`Erro ao tentar ${action}:`, err);
        alert(`Erro de conexão ao tentar ${action}.`);
    }
  };

  if (loading) return <p className={styles.loading}>Carregando perfil...</p>;
  if (!profileUser) return <p className={styles.loading}>Perfil não encontrado. <Link to="/home">Voltar para Home</Link></p>;

  const isOwnProfile = loggedUserId === profileUser.id;

  return (
    <div className={styles.profilePageContainer}>
      <aside className={styles.profileSidebar}>
        <img
          className={styles.profileUserPhoto}
          src={profileUser.profile_pic_url || `https://i.pravatar.cc/150?u=${profileUser.id}`}
          alt={`Foto de ${profileUser.nome}`}
        />
        <h2 className={styles.profileUserName}>{profileUser.nome}</h2>
        {profileUser.email && <p className={styles.profileUserEmail}>{profileUser.email}</p>}

        {!isOwnProfile && loggedUserId && (
          <button 
            className={`${styles.profileActionButton} ${isFollowing ? styles.unfollowButton : styles.followButton}`} 
            onClick={handleFollow}
          >
            {isFollowing ? 'Deixar de Seguir' : 'Seguir'}
          </button>
        )}

        {profileUser.descricao && (
            <div className={styles.profileSection}>
                <h3 className={styles.sectionTitle}>Descrição</h3>
                <p className={styles.profileDescriptionText}>{profileUser.descricao}</p>
            </div>
        )}
       {profileUser.links_sociais && (
            <div className={styles.profileSection}>
                <h3 className={styles.sectionTitle}>Redes Sociais / Streaming</h3>
                <ul className={styles.socialLinksList}>
                    {profileUser.links_sociais.split(',').map((link, index) => link.trim() && (
                        <li key={index}>
                            <Link to={!link.startsWith('http') ? `https://${link.trim()}` : link.trim()} target="_blank" rel="noopener noreferrer">
                                {link.trim().replace(/^https?:\/\//, '')}
                            </Link>
                        </li>
                    ))}
                </ul>
            </div>
        )}
      </aside>

      <main className={styles.profileContentArea}>
        <div className={styles.profileTabs}>
          <button
            className={`${styles.tabButton} ${activeTab === 'projetos' ? styles.activeTabButton : ''}`}
            onClick={() => setActiveTab('projetos')}
          >
            <MusicIcon /> Projetos <span className={styles.tabCount}>({projects.length})</span>
          </button>
          <button
            className={`${styles.tabButton} ${activeTab === 'amigos' ? styles.activeTabButton : ''}`}
            onClick={() => setActiveTab('amigos')}
          >
            <PeopleIcon /> Seguidores <span className={styles.tabCount}>({friends.length})</span>
          </button>
        </div>

        <div className={styles.tabContent}>
          {activeTab === 'projetos' && (
            <div className={styles.postsGrid}>
              {projects.length > 0 ? projects.map(post => (
                <div key={post.id} className={styles.postCard}>
                  <Link to={`/post/${post.id}`} className={styles.postCardLinkWrapper}>
                    <h5 className={styles.postCardTitle}>{post.titulo || "Projeto sem título"}</h5>
                    <p className={styles.postCardDescription}>
                      {post.texto ? (post.texto.substring(0, 100) + (post.texto.length > 100 ? '...' : '')) : (post.descricao || "Sem descrição.")}
                    </p>
                  </Link>
                  {post.audio_url && (
                    <audio controls src={post.audio_url} className={styles.postCardAudioPlayer}>
                      Seu navegador não suporta o elemento de áudio.
                    </audio>
                  )}
                  <small className={styles.postCardDate}>
                    {new Date(post.created_at || post.data_criacao || post.data || Date.now()).toLocaleDateString('pt-BR')}
                  </small>
                </div>
              )) : <p className={styles.emptyTabText}>Este usuário ainda não criou projetos.</p>}
            </div>
          )}

          {activeTab === 'amigos' && (
            <div className={styles.userList}>
              {friends.length > 0 ? friends.map(amigo => (
                <Link to={`/usuario/${amigo.id}`} key={amigo.id} className={styles.userListItem}>
                  <img
                    src={amigo.profile_pic_url || amigo.foto || `https://i.pravatar.cc/40?u=${amigo.id}`}
                    alt={amigo.nome}
                  />
                  <span>{amigo.nome}</span>
                </Link>
              )) : <p className={styles.emptyTabText}>Este usuário ainda não tem seguidores.</p>}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
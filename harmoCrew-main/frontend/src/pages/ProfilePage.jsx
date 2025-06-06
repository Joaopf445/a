import React, { useEffect, useState, useCallback } from 'react';
import styles from '../styles/ProfilePage.module.css';
import { useAuth } from '../context/AuthContext';
import { useParams, useNavigate, Link } from 'react-router-dom';
import "../styles/global.css";
import "../styles/colors.css";

const EditIcon = () => <span style={{ cursor: 'pointer', marginLeft: '8px', fontSize: '0.9em' }}>✏️</span>;
const LinkIcon = () => <span style={{ marginRight: '8px', color: 'var(--accent-blue)' }}>🔗</span>;
const MusicIcon = () => <span style={{ marginRight: '8px' }}>🎵</span>;
const PeopleIcon = () => <span style={{ marginRight: '8px' }}>👥</span>;

export default function ProfilePage() {
  const { user: loggedUser, token, logout } = useAuth();
  const { id: profileIdFromParams } = useParams();
  const navigate = useNavigate();

  const [profileData, setProfileData] = useState(null);
  const [userPosts, setUserPosts] = useState([]);
  const [followingList, setFollowingList] = useState([]);
  const [followersList, setFollowersList] = useState([]);
  
  const [activeTab, setActiveTab] = useState('beats');
  const [isCurrentUserProfile, setIsCurrentUserProfile] = useState(false);
  const [isFollowingProfile, setIsFollowingProfile] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [editingDescricao, setEditingDescricao] = useState(false);
  const [novaDescricao, setNovaDescricao] = useState("");
  const [editingLinks, setEditingLinks] = useState(false);
  const [novosLinks, setNovosLinks] = useState("");

  const userIdToFetch = profileIdFromParams ? parseInt(profileIdFromParams) : loggedUser?.id;

  const fetchProfileData = useCallback(async () => {
    if (!userIdToFetch || !token) {
      if (!loggedUser && !profileIdFromParams) {
        navigate('/login');
      }
      setLoadingProfile(false);
      return;
    }
    setLoadingProfile(true);
    try {
      const res = await fetch(`http://localhost:5000/user/${userIdToFetch}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        if (res.status === 401) { logout(); navigate('/login'); }
        throw new Error(`Falha ao buscar dados do perfil (status ${res.status}).`);
      }
      const data = await res.json();
      if (data.user) {
        setProfileData(data.user);
        setNovaDescricao(data.user.descricao || "");
        setNovosLinks(data.user.links_sociais || "");
        setIsCurrentUserProfile(loggedUser?.id === data.user.id);
        setIsFollowingProfile(data.user.is_following || false);
      } else {
        throw new Error('Usuário não encontrado nos dados recebidos.');
      }
    } catch (error) {
      console.error("Erro ao buscar dados do perfil:", error.message);
      setProfileData(null);
    } finally {
      setLoadingProfile(false);
    }
  }, [userIdToFetch, token, loggedUser?.id, logout, navigate, profileIdFromParams]);

  const fetchUserContent = useCallback(async () => {
    if (!userIdToFetch || !token) return;

    try {
      const resPosts = await fetch(`http://localhost:5000/user/${userIdToFetch}/posts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resPosts.ok) {
        const dataPosts = await resPosts.json();
        setUserPosts(dataPosts.posts || []);
      } else { console.error("Falha ao buscar posts do usuário"); setUserPosts([]); }
    } catch (error) { console.error("Erro de conexão ao buscar posts:", error); setUserPosts([]);}

    try {
      const resFollowing = await fetch(`http://localhost:5000/user/${userIdToFetch}/following`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resFollowing.ok) {
        const dataFollowing = await resFollowing.json();
        setFollowingList(dataFollowing.following || []);
      } else { console.error("Falha ao buscar 'seguindo'"); setFollowingList([]);}
    } catch (error) { console.error("Erro de conexão ao buscar 'seguindo':", error); setFollowingList([]);}

    try {
      const resFollowers = await fetch(`http://localhost:5000/user/${userIdToFetch}/followers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resFollowers.ok) {
        const dataFollowers = await resFollowers.json();
        setFollowersList(dataFollowers.followers || []);
      } else { console.error("Falha ao buscar seguidores"); setFollowersList([]);}
    } catch (error) { console.error("Erro de conexão ao buscar seguidores:", error); setFollowersList([]);}
  }, [userIdToFetch, token]);

  useEffect(() => {
    if (userIdToFetch) {
        fetchProfileData();
        fetchUserContent();
    } else if (!profileIdFromParams && !loggedUser && !token) { 
        navigate('/login');
    }
  }, [userIdToFetch, profileIdFromParams, loggedUser, token, fetchProfileData, fetchUserContent, navigate]);


  const handleFollowToggle = async () => {
    if (!token || !profileData || isCurrentUserProfile) return;
    const action = isFollowingProfile ? 'unfollow' : 'follow';
    const endpoint = `http://localhost:5000/${action}/${profileData.id}`;

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setIsFollowingProfile(!isFollowingProfile);
        fetchProfileData(); 
      } else {
        const errorData = await res.json();
        alert(`Erro ao ${action === 'follow' ? 'seguir' : 'deixar de seguir'}: ${errorData.message || 'Tente novamente.'}`);
      }
    } catch (error) {
      console.error(`Erro ao tentar ${action}:`, error);
      alert(`Erro de conexão ao tentar ${action === 'follow' ? 'seguir' : 'deixar de seguir'}.`);
    }
  };
  
  const handleSaveDescricao = async () => {
    if (!token || !isCurrentUserProfile || !profileData) return;
    try {
        const res = await fetch(`http://localhost:5000/user/me/descricao`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}` 
            },
            body: JSON.stringify({ descricao: novaDescricao }),
        });
        if (res.ok) {
            setProfileData(prev => ({ ...prev, descricao: novaDescricao }));
            setEditingDescricao(false);
            alert("Descrição atualizada!");
        } else {
            const errorData = await res.json();
            alert(`Erro ao atualizar descrição: ${errorData.message || "Tente novamente."}`);
        }
    } catch (error) {
        console.error("Erro ao salvar descrição:", error);
        alert("Erro de conexão ao salvar descrição.");
    }
  };

  const handleSaveLinks = async () => {
    if (!token || !isCurrentUserProfile || !profileData) return;
    try {
        const res = await fetch(`http://localhost:5000/user/me/links`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}` 
            },
            body: JSON.stringify({ links_sociais: novosLinks }),
        });
        if (res.ok) {
            setProfileData(prev => ({ ...prev, links_sociais: novosLinks }));
            setEditingLinks(false);
            alert("Links atualizados!");
        } else {
            const errorData = await res.json();
            alert(`Erro ao atualizar links: ${errorData.message || "Tente novamente."}`);
        }
    } catch (error) {
        console.error("Erro ao salvar links:", error);
        alert("Erro de conexão ao salvar links.");
    }
  };

  if (loadingProfile) return <div className={styles.loading}>Carregando perfil...</div>;
  if (!profileData) return <div className={styles.loading}>Perfil não encontrado ou não foi possível carregar. <Link to="/home">Voltar para Home</Link></div>;

  const descricaoDoPerfil = profileData.descricao || (isCurrentUserProfile ? "Conte um pouco sobre você, seus gostos musicais, o que você procura no HarmoCrew..." : "Este músico ainda não adicionou uma descrição.");
  const linksSociaisString = profileData.links_sociais || "";
  const linksArray = linksSociaisString.split(',').map(link => link.trim()).filter(link => link && link.length > 0);

  return (
    <div className={styles.profilePageContainer}>
      <aside className={styles.profileSidebar}>
        <img
          className={styles.profileUserPhoto}
          src={profileData.profile_pic_url || `https://i.pravatar.cc/150?u=${profileData.id}`}
          alt={`Foto de ${profileData.nome}`}
        />
        <h2 className={styles.profileUserName}>{profileData.nome}</h2>
        {profileData.email && <p className={styles.profileUserEmail}>{profileData.email}</p>}

        {!isCurrentUserProfile && (
          <button
            className={`${styles.profileActionButton} ${isFollowingProfile ? styles.unfollowButton : styles.followButton}`}
            onClick={handleFollowToggle}
          >
            {isFollowingProfile ? 'Deixar de Seguir' : 'Seguir'}
          </button>
        )}
        
        <div className={styles.profileSection}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>Descrição</h3>
            {isCurrentUserProfile && !editingDescricao && (
              <button onClick={() => { setEditingDescricao(true); setNovaDescricao(profileData.descricao || ""); }} className={styles.editButtonInline} title="Editar descrição"><EditIcon /></button>
            )}
          </div>
          {editingDescricao && isCurrentUserProfile ? (
            <div className={styles.editFormInline}>
              <textarea 
                value={novaDescricao} 
                onChange={(e) => setNovaDescricao(e.target.value)}
                rows="5"
                placeholder="Sua descrição aqui..."
              />
              <div className={styles.editActionsInline}>
                <button onClick={handleSaveDescricao} className={styles.saveButtonInline}>Salvar</button>
                <button onClick={() => setEditingDescricao(false)} className={styles.cancelButtonInline}>Cancelar</button>
              </div>
            </div>
          ) : (
            <p className={styles.profileDescriptionText}>{descricaoDoPerfil}</p>
          )}
        </div>

        <div className={styles.profileSection}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>Redes Sociais / Streaming</h3>
            {isCurrentUserProfile && !editingLinks && (
              <button onClick={() => { setEditingLinks(true); setNovosLinks(profileData.links_sociais || ""); }} className={styles.editButtonInline} title="Editar links"><EditIcon /></button>
            )}
          </div>
          {editingLinks && isCurrentUserProfile ? (
            <div className={styles.editFormInline}>
              <textarea
                placeholder="Ex: twitter.com/user, spotify.com/artist/id (um por linha ou separados por vírgula)"
                value={novosLinks} 
                onChange={(e) => setNovosLinks(e.target.value)} 
                rows="4"
              />
              <div className={styles.editActionsInline}>
                <button onClick={handleSaveLinks} className={styles.saveButtonInline}>Salvar</button>
                <button onClick={() => setEditingLinks(false)} className={styles.cancelButtonInline}>Cancelar</button>
              </div>
            </div>
          ) : (
            <ul className={styles.socialLinksList}>
              {linksArray.length > 0 ? linksArray.map((link, index) => (
                <li key={index}>
                  <LinkIcon />
                  <a href={!link.startsWith('http://') && !link.startsWith('https://') ? `https://${link}` : link} target="_blank" rel="noopener noreferrer">
                    {link.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                  </a>
                </li>
              )) : <p className={styles.noLinksText}>{isCurrentUserProfile ? "Adicione seus links." : "Nenhum link adicionado."}</p>}
            </ul>
          )}
        </div>
      </aside>

      <main className={styles.profileContentArea}>
        <div className={styles.profileTabs}>
          <button
            className={`${styles.tabButton} ${activeTab === 'beats' ? styles.activeTabButton : ''}`}
            onClick={() => setActiveTab('beats')}
          >
            <MusicIcon /> Beats / Projetos <span className={styles.tabCount}>({userPosts.length})</span>
          </button>
          <button
            className={`${styles.tabButton} ${activeTab === 'seguindo' ? styles.activeTabButton : ''}`}
            onClick={() => setActiveTab('seguindo')}
          >
            <PeopleIcon /> Seguindo <span className={styles.tabCount}>({followingList.length})</span>
          </button>
          <button
            className={`${styles.tabButton} ${activeTab === 'seguidores' ? styles.activeTabButton : ''}`}
            onClick={() => setActiveTab('seguidores')}
          >
             <PeopleIcon /> Seguidores <span className={styles.tabCount}>({followersList.length})</span>
          </button>
        </div>

        <div className={styles.tabContent}>
          {activeTab === 'beats' && (
            <div className={styles.postsGrid}>
              {userPosts.length > 0 ? userPosts.map(post => (
                <div key={post.id} className={styles.postCard}>
                  <Link to={`/post/${post.id}`} className={styles.postCardLinkWrapper}>
                    <h5 className={styles.postCardTitle}>{post.titulo || "Projeto sem título"}</h5>
                    <p className={styles.postCardDescription}>{post.texto ? (post.texto.substring(0, 100) + (post.texto.length > 100 ? '...' : '')) : "Sem descrição."}</p>
                  </Link>
                  {post.audio_url && (
                    <audio controls src={post.audio_url} className={styles.postCardAudioPlayer}>
                      Seu navegador não suporta o elemento de áudio.
                    </audio>
                  )}
                  <small className={styles.postCardDate}>{new Date(post.created_at || post.data_criacao || Date.now()).toLocaleDateString('pt-BR')}</small>
                </div>
              )) : <p className={styles.emptyTabText}>Nenhum beat ou projeto publicado ainda.</p>}
            </div>
          )}

          {activeTab === 'seguindo' && (
            <div className={styles.userList}>
              {followingList.length > 0 ? followingList.map(user => (
                <Link to={`/usuario/${user.id}`} key={user.id} className={styles.userListItem}>
                  <img src={user.profile_pic_url || `https://i.pravatar.cc/40?u=${user.id}`} alt={user.nome} />
                  <span>{user.nome}</span>
                </Link>
              )) : <p className={styles.emptyTabText}>{isCurrentUserProfile ? "Você não segue ninguém ainda." : "Este usuário não segue ninguém."}</p>}
            </div>
          )}

          {activeTab === 'seguidores' && (
            <div className={styles.userList}>
              {followersList.length > 0 ? followersList.map(user => (
                <Link to={`/usuario/${user.id}`} key={user.id} className={styles.userListItem}>
                  <img src={user.profile_pic_url || `https://i.pravatar.cc/40?u=${user.id}`} alt={user.nome} />
                  <span>{user.nome}</span>
                </Link>
              )) : <p className={styles.emptyTabText}>{isCurrentUserProfile ? "Você não tem seguidores ainda." : "Nenhum seguidor ainda."}</p>}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
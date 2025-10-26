import { useEffect, useState, useRef } from 'react'
import { DataGrid } from '@mui/x-data-grid';
import { Box, Button, Chip, Stack, Container, Paper, TextField, Typography, AppBar, Toolbar, IconButton, Alert, Tooltip, Avatar } from '@mui/material';
import { Search, Add, Logout, Bookmark, Language, Image } from '@mui/icons-material';
import './App.css'

function App() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [user, setUser] = useState(null)
  const [bookmarkUrl, setBookmarkUrl] = useState('')
  const [bookmarkTitle, setBookmarkTitle] = useState('')
  const [bookmarkTags, setBookmarkTags] = useState('')
  const [bookmarks, setBookmarks] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTag, setSelectedTag] = useState('')
  const [allTags, setAllTags] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [popup, setPopup] = useState(null)
  const [confirmDialog, setConfirmDialog] = useState(null)
  const [isSignupMode, setIsSignupMode] = useState(false)
  const [name, setName] = useState('')

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('Logging in...');

    try {
      const res = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (data.success) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user)); // Store user data
        setUser(data.user);
        setIsLoggedIn(true);
        setMessage(`Welcome back, ${data.user.name}!`);
      } else {
        setMessage(`${data.message}`);
      }
    } catch (error) {
      setMessage('Cannot connect to server');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setIsLoggedIn(false);
    setUser(null);
    setMessage('');
    setBookmarks([]);
    setSearchTerm('');
    setBookmarkUrl('');
    setBookmarkTitle('');
    setSelectedTag('');
    setAllTags([]);
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('Creating account...');

    try {
      const res = await fetch('http://localhost:5000/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          email,
          password
        }),
      });

      const data = await res.json();

      if (data.success) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        setUser(data.user);
        setIsLoggedIn(true);
        setMessage(`Welcome to LinkVault, ${data.user.name}!`);
      } else {
        setMessage(`${data.message}`);
      }
    } catch (error) {
      setMessage('Cannot connect to server');
    } finally {
      setIsLoading(false);
    }
  };

  const addBookmark = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    setIsLoading(true);

    try {
      const existingBookmark = bookmarks.find(bookmark => bookmark.url === bookmarkUrl);
      if (existingBookmark) {
        setIsLoading(false);
        setConfirmDialog({
          message: `This bookmark URL already exists${existingBookmark.title ? ` as "${existingBookmark.title}"` : ''}. Do you want to add it as a duplicate?`,
          onConfirm: async () => {
            setIsLoading(true);
            await proceedWithBookmarkAdd(token);
            setConfirmDialog(null);
          },
          onCancel: () => {
            setConfirmDialog(null);
            setIsLoading(false);
            setBookmarkUrl('');
            setBookmarkTitle('');
            setBookmarkTags('');
          },
          confirmText: 'Yes, Add Duplicate',
          cancelText: 'Cancel'
        })
        return;
      }
      await proceedWithBookmarkAdd(token);
    } catch (error) {
      setPopup({ type: 'error', message: 'Error connecting to server' });
      setTimeout(() => setPopup(null), 3000);
      setIsLoading(false);
    }
  };

  const proceedWithBookmarkAdd = async (token) => {
    try {
      const res = await fetch('http://localhost:5000/api/bookmarks', {
        method: 'POST',
        headers: {
          'Content-type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          url: bookmarkUrl,
          title: bookmarkTitle,
          tags: bookmarkTags
        })
      });

      const data = await res.json();
      if (data.success) {
        setBookmarkUrl('');
        setBookmarkTitle('');
        setBookmarkTags('');
        fetchBookmarks(searchTerm);
        fetchAllTags();
        setPopup({ type: 'success', message: 'Bookmark added successfully!' });
        setTimeout(() => setPopup(null), 3000);
      } else {
        setPopup({ type: 'error', message: 'Failed to add bookmark: ' + data.message });
        setTimeout(() => setPopup(null), 3000);
      }
    } catch (error) {
      setPopup({ type: 'error', message: 'Error connecting to server' });
      setTimeout(() => setPopup(null), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBookmarks = async (searchQuery = '', tagFilter = '') => {
    try {
      let url = 'http://localhost:5000/api/bookmarks';
      const params = new URLSearchParams();
      if (searchQuery) {
        params.append('searchparam', searchQuery);
      }
      if (tagFilter) {
        params.append('tag', tagFilter);
      }
      if (params.toString()) {
        url += '?' + params.toString();
      }
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await res.json();
      if (data.success) {
        console.log('Bookmark data received:', data.bookmarks[0]);
        setBookmarks(data.bookmarks);
      }
    } catch (error) {
      console.error('Error fetching bookmarks:', error);
    }
  };

  const fetchAllTags = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/bookmarks/tags', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await res.json();
      if (data.success) {
        setAllTags(data.tags);
      }
    } catch (error) {
      console.error('Error fetching tags:', error);
    }
  };

  const clearSearch = () => {
    setSearchTerm('');
    setSelectedTag('');
    fetchBookmarks();
  };

  const filterByTag = (tag) => {
    setSelectedTag(tag);
    setSearchTerm('');
    fetchBookmarks('', tag);
  };

  const deleteBookmark = async (bookmarkId) => {
    setConfirmDialog({
      message: 'Delete this bookmark?',
      onConfirm: async () => {
        try {
          const res = await fetch(`http://localhost:5000/api/bookmarks/${bookmarkId}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          });

          const data = await res.json();
          if (data.success) {
            fetchBookmarks(searchTerm, selectedTag);
            fetchAllTags();
            setPopup({ type: 'success', message: 'Bookmark deleted successfully!' });
            setTimeout(() => setPopup(null), 3000);
          } else {
            setPopup({ type: 'error', message: 'Failed to delete bookmark: ' + data.message });
            setTimeout(() => setPopup(null), 3000);
          }
        } catch (error) {
          console.error('Error deleting bookmark:', error);
          setPopup({ type: 'error', message: 'Error deleting bookmark' });
          setTimeout(() => setPopup(null), 3000);
        }
        setConfirmDialog(null);
      },
      onCancel: () => {
        setConfirmDialog(null)
      }
    });
  };

  const renderTags = (tags) => {
    if (!tags) return null;
    const tagArray = tags.split(',').map(tag => tag.trim()).filter(tag => tag);
    return (
      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
        {tagArray.map((tag, index) => (
          <Chip
            key={index}
            label={tag}
            size="small"
            onClick={() => filterByTag(tag)}
            sx={{
              backgroundColor: '#e1f5fe',
              color: '#0277bd',
              fontSize: '11px',
              height: '20px',
              cursor: 'pointer',
              '&:hover': {
                backgroundColor: '#b3e5fc'
              }
            }}
          />
        ))}
      </Stack>
    );
  };

  const EditCell = ({ id, field, value, api }) => {
    const [editValue, setEditValue] = useState(value || '');
    const inputRef = useRef(null);

    useEffect(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, []);

    const handleSave = () => {
      api.setEditCellValue({ id, field, value: editValue });
      api.stopCellEditMode({ id, field });
    };

    const handleKeyPress = (e) => {
      if (e.key === 'Enter') {
        handleSave();
      } else if (e.key === 'Escape') {
        api.stopCellEditMode({ id, field, ignoreModifications: true });
      }
    };

    const getPlaceholder = () => {
      switch (field) {
        case 'url': return 'Enter URL';
        case 'title': return 'Enter Title';
        case 'description': return 'Enter Description';
        case 'tags': return 'Enter Tags';
        default: return `Enter ${field}`;
      }
    };

    return (
      <input
        ref={inputRef}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyPress}
        style={{
          width: '100%',
          border: 'none',
          outline: 'none',
          padding: '8px',
          fontSize: '14px'
        }}
        placeholder={field === 'url' ? 'Enter URL' : field === 'title' ? 'Enter Title' : 'Enter Tags'}
        type={field === 'url' ? 'url' : 'text'}
      />
    );
  };

  const getMetadataQuality = (bookmark) => {
    let score = 0;
    let maxScore = 3;
    let details = [];

    // Check each metadata component
    if (bookmark.title && bookmark.title.trim() !== '' && bookmark.title !== 'Untitled') {
      score += 1;
      details.push('✅ Title');
    } else {
      details.push('❌ Title');
    }

    if (bookmark.description && bookmark.description.trim() !== '') {
      score += 1;
      details.push('✅ Description');
    } else {
      details.push('❌ Description');
    }

    if (bookmark.favicon && bookmark.favicon.trim() !== '') {
      score += 1;
      details.push('✅ Favicon');
    } else {
      details.push('❌ Favicon');
    }

    const percentage = (score / maxScore) * 100;

    // Determine quality level
    let level = 'poor';
    let color = 'error';
    let bgColor = '#fee2e2';
    let textColor = '#dc2626';

    if (score === 3) {
      level = 'excellent';
      color = 'success';
      bgColor = '#dcfce7';
      textColor = '#16a34a';
    } else if (score === 2) {
      level = 'good';
      color = 'success';
      bgColor = '#dbeafe';
      textColor = '#2563eb';
    } else if (score === 1) {
      level = 'fair';
      color = 'warning';
      bgColor = '#fef3c7';
      textColor = '#d97706';
    }

    return { score, maxScore, percentage, level, color, bgColor, textColor, details };
  };

  const MetadataQualityIndicator = ({ bookmark }) => {
    const quality = getMetadataQuality(bookmark);

    return (
      <Box
        sx={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <Tooltip
          title={
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                Metadata Quality: {quality.level.toUpperCase()}
              </Typography>
              {quality.details.map((detail, index) => (
                <Typography key={index} variant="caption" sx={{ display: 'block', fontSize: '11px' }}>
                  {detail}
                </Typography>
              ))}
            </Box>
          }
          arrow
        >
          <Chip
            label={`${quality.score}/3`}
            size="small"
            sx={{
              backgroundColor: quality.bgColor,
              color: quality.textColor,
              fontWeight: 600,
              fontSize: '12px',
              cursor: 'help',
              '&:hover': {
                opacity: 0.8
              }
            }}
          />
        </Tooltip>
      </Box>
    );
  };

  const columns = [
    {
      field: 'title',
      headerName: 'Bookmark',
      width: 400,
      minWidth: 300,
      flex: 2,
      editable: true,
      renderCell: (params) => {
        if (!params.value && !params.row.url) return 'No Title';
        return (
          <Box sx={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            py: 2
          }}>
            {/* Website Favicon/Image */}
            <Box sx={{ flexShrink: 0 }}>
              {params.row.favicon ? (
                <Avatar
                  src={params.row.favicon}
                  variant="rounded"
                  sx={{
                    width: 32,
                    height: 32,
                    border: '1px solid #e2e8f0'
                  }}
                >
                  <Language fontSize="small" />
                </Avatar>
              ) : (
                <Avatar
                  variant="rounded"
                  sx={{
                    width: 32,
                    height: 32,
                    bgcolor: '#f1f5f9',
                    color: '#64748b'
                  }}
                >
                  <Language fontSize="small" />
                </Avatar>
              )}
            </Box>

            {/* Content */}
            <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              {/* Title */}
              <Box sx={{ mb: 1 }}>
                <Typography
                  sx={{
                    color: '#1e293b',
                    fontSize: '15px',
                    fontWeight: 600,
                    display: 'block',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    cursor: 'text',
                    lineHeight: 1.3
                  }}
                  title={params.value || 'No Title'}
                >
                  {params.value || 'No Title'}
                </Typography>
              </Box>

              {/* Site name and Tags */}
              {/* <Box sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                flexWrap: 'wrap'
              }}>
                {params.row.site_name && (
                  <Typography
                    variant="caption"
                    sx={{
                      color: '#94a3b8',
                      fontSize: '11px',
                      backgroundColor: '#f8fafc',
                      px: 1.5,
                      py: 0.5,
                      borderRadius: 1.5,
                      border: '1px solid #e2e8f0',
                      fontWeight: 500
                    }}
                  >
                    {params.row.site_name}
                  </Typography>
                )}
                {renderTags(params.row.tags)}
              </Box> */}
            </Box>
          </Box>
        );
      },
      renderEditCell: (params) => <EditCell {...params} />
    },
    {
      field: 'url',
      headerName: 'URL',
      width: 350,
      minWidth: 200,
      flex: 1,
      editable: true,
      renderCell: (params) => (
        <Box
          sx={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            overflow: 'hidden'
          }}
          title={params.value} // Tooltip for full URL
        >
          <a
            href={params.value}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: '#64748b',
              textDecoration: 'none',
              fontSize: '13px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              width: '100%'
            }}
            onMouseOver={(e) => e.target.style.textDecoration = 'underline'}
            onMouseOut={(e) => e.target.style.textDecoration = 'none'}
          >
            {params.value}
          </a>
        </Box>
      ),
      renderEditCell: (params) => <EditCell {...params} />
    },
    {
      field: 'description',
      headerName: 'Description',
      width: 300,
      minWidth: 200,
      flex: 1,
      editable: true,
      renderCell: (params) => (
        <Box
          sx={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            overflow: 'hidden'
          }}
          title={params.value || 'No description available'}
        >
          <Typography
            variant="body2"
            sx={{
              color: params.value ? '#64748b' : '#ff5722',
              fontSize: '13px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              width: '100%'
            }}
          >
            {params.value || 'NO DESCRIPTION'}
          </Typography>
        </Box>
      ),
      renderEditCell: (params) => <EditCell {...params} />
    },
    {
      field: 'tags',
      headerName: 'Tags',
      width: 200,
      minWidth: 150,
      flex: 1,
      editable: true,
      renderCell: (params) => (
        <Box
          sx={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            overflow: 'hidden'
          }}
          title={params.value}
        >
          {renderTags(params.value)}
        </Box>
      ),
      renderEditCell: (params) => <EditCell {...params} />
    },
    {
      field: 'updated_at',
      headerName: 'Last Modified',
      width: 180,
      minWidth: 150,
      renderCell: (params) => {
        // Handle cases where DataGrid calls formatter before row data is loaded
        if (!params || !params.row) {
          return '';
        }

        const dateValue = params.row.updated_at || params.row.created_at;

        if (!dateValue) {
          return (
            <Box
              sx={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <Typography
                variant="body2"
                sx={{
                  color: '#94a3b8',
                  fontSize: '13px'
                }}
              >
                No Date
              </Typography>
            </Box>
          );
        }

        try {
          const formattedDate = new Date(dateValue).toLocaleString();
          return (
            <Box
              sx={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <Typography
                variant="body2"
                sx={{
                  color: '#64748b',
                  fontSize: '13px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
                title={formattedDate}
              >
                {formattedDate}
              </Typography>
            </Box>
          );
        } catch (error) {
          console.error('Date formatting error:', error);
          return (
            <Box
              sx={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <Typography
                variant="body2"
                sx={{
                  color: '#ef4444',
                  fontSize: '13px'
                }}
              >
                Invalid Date
              </Typography>
            </Box>
          );
        }
      }
    },
    {
      field: 'metadata_quality',
      headerName: 'Quality',
      width: 100,
      minWidth: 80,
      sortable: true,
      filterable: false,
      resizable: false,
      renderCell: (params) => <MetadataQualityIndicator bookmark={params.row} />,
      // Custom sort function to sort by quality score
      sortComparator: (v1, v2, cellParams1, cellParams2) => {
        const quality1 = getMetadataQuality(cellParams1.row);
        const quality2 = getMetadataQuality(cellParams2.row);
        return quality1.score - quality2.score;
      }
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 120,
      minWidth: 100,
      sortable: false,
      filterable: false,
      resizable: false,
      renderCell: (params) => (
        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            variant="contained"
            color="error"
            onClick={() => deleteBookmark(params.id)}
            sx={{ minWidth: '60px', fontSize: '11px' }}
          >
            Delete
          </Button>
        </Stack>
      )
    }
  ];

  const processRowUpdate = async (newRow, oldRow) => {
    // Check if any field has actually changed
    const hasChanges = (
      newRow.url !== oldRow.url ||
      newRow.title !== oldRow.title ||
      newRow.description !== oldRow.description ||
      newRow.tags !== oldRow.tags
    );

    // If no changes were made, just return the old row without API call
    if (!hasChanges) {
      console.log('No changes detected, skipping update');
      return oldRow;
    }

    try {
      const res = await fetch(`http://localhost:5000/api/bookmarks/${newRow.id}`, {
        method: 'PUT',
        headers: {
          'Content-type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          url: newRow.url,
          title: newRow.title,
          description: newRow.description,
          tags: newRow.tags
        })
      });

      const data = await res.json();
      if (data.success) {
        const urlChanged = newRow.url !== oldRow.url;
        const message = urlChanged
          ? 'Bookmark updated with fresh metadata!'
          : 'Bookmark updated successfully!';

        setPopup({ type: 'success', message });
        setTimeout(() => setPopup(null), 3000);

        await fetchBookmarks(searchTerm, selectedTag);
        fetchAllTags();

        return data.bookmark;
      } else {
        setPopup({ type: 'error', message: 'Failed to update bookmark: ' + data.message });
        setTimeout(() => setPopup(null), 3000);
        return oldRow;
      }
    } catch (error) {
      console.error('Error updating bookmark:', error);
      setPopup({ type: 'error', message: 'Error updating bookmark' });
      setTimeout(() => setPopup(null), 3000);
      return oldRow;
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      fetchBookmarks();
      fetchAllTags();
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (isLoggedIn) {
      const timeoutId = setTimeout(() => {
        fetchBookmarks(searchTerm, selectedTag);
      }, 300);

      return () => clearTimeout(timeoutId);
    }
  }, [searchTerm, isLoggedIn]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    if (token && storedUser && !isLoggedIn) {
      setIsLoggedIn(true);
      setUser(JSON.parse(storedUser));
    }
  }, []);

  if (isLoggedIn) {
    return (
      <Box sx={{
        backgroundColor: '#f8fafc',
        minHeight: '100vh',
        width: '100vw',
        margin: 0,
        padding: 0
      }}>
        {/* Header */}
        <AppBar position="static" sx={{
          backgroundColor: 'white',
          color: '#1e293b',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          borderBottom: '1px solid #e2e8f0'
        }}>
          <Toolbar>
            <Bookmark sx={{ mr: 2, color: '#3b82f6' }} />
            <Typography variant="h6" component="div" sx={{
              flexGrow: 1,
              fontWeight: 600,
              color: '#1e293b'
            }}>
              LinkVault
            </Typography>
            <Typography variant="body2" sx={{
              mr: 2,
              color: '#64748b',
              display: { xs: 'none', sm: 'block' }
            }}>
              Welcome, {user.name}
            </Typography>
            <IconButton
              onClick={handleLogout}
              sx={{
                color: '#64748b',
                '&:hover': { backgroundColor: '#f1f5f9' }
              }}
            >
              <Logout />
            </IconButton>
          </Toolbar>
        </AppBar>

        <Box sx={{
          px: { xs: 2, sm: 4, md: 6 },
          py: 4,
          width: '100%',
          maxWidth: 'none'
        }}>
          {/* Notifications */}
          {popup && (
            <Alert
              severity={popup.type}
              sx={{
                position: 'fixed',
                top: 90,
                right: 20,
                zIndex: 1000,
                minWidth: 300
              }}
            >
              {popup.message}
            </Alert>
          )}

          {/* Confirm Dialog */}
          {confirmDialog && (
            <Box
              sx={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1001
              }}
              onClick={() => {
                if (confirmDialog.onCancel) {
                  confirmDialog.onCancel();
                } else {
                  setConfirmDialog(null);
                }
              }}
            >
              <Paper
                elevation={8}
                sx={{
                  p: 4,
                  maxWidth: 400,
                  textAlign: 'center',
                  position: 'relative'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <IconButton
                  onClick={() => {
                    if (confirmDialog.onCancel) {
                      confirmDialog.onCancel();
                    } else {
                      setConfirmDialog(null);
                    }
                  }}
                  sx={{ position: 'absolute', top: 8, right: 8 }}
                >
                  ✕
                </IconButton>
                <Typography variant="body1" sx={{ mb: 3, color: '#1e293b' }}>
                  {confirmDialog.message}
                </Typography>
                <Stack direction="row" spacing={2} justifyContent="center">
                  <Button
                    onClick={confirmDialog.onConfirm}
                    variant="contained"
                    color={confirmDialog.confirmText === 'Yes, Add Duplicate' ? 'warning' : 'error'}
                  >
                    {confirmDialog.confirmText || 'Delete'}
                  </Button>
                  <Button
                    onClick={confirmDialog.onCancel}
                    variant="outlined"
                    color="inherit"
                  >
                    {confirmDialog.cancelText || 'Cancel'}
                  </Button>
                </Stack>
              </Paper>
            </Box>
          )}

          {/* Add New Bookmark Section */}
          <Paper elevation={0} sx={{ p: 3, mb: 4, border: '1px solid #e2e8f0' }}>
            <Typography variant="h5" sx={{ mb: 3, fontWeight: 600, color: '#1e293b' }}>
              Add New Bookmark
            </Typography>
            <Box component="form" onSubmit={addBookmark}>
              <Stack spacing={2}>
                <TextField
                  fullWidth
                  type="url"
                  label="Website URL"
                  value={bookmarkUrl}
                  onChange={(e) => setBookmarkUrl(e.target.value)}
                  required
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: '#f8fafc',
                      '&:hover fieldset': { borderColor: '#3b82f6' },
                      '&.Mui-focused fieldset': { borderColor: '#3b82f6' }
                    }
                  }}
                />
                <TextField
                  fullWidth
                  label="Title (optional)"
                  value={bookmarkTitle}
                  onChange={(e) => setBookmarkTitle(e.target.value)}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: '#f8fafc',
                      '&:hover fieldset': { borderColor: '#3b82f6' },
                      '&.Mui-focused fieldset': { borderColor: '#3b82f6' }
                    }
                  }}
                />
                <TextField
                  fullWidth
                  label="Tags (comma-separated, e.g., work, javascript, tutorial)"
                  value={bookmarkTags}
                  onChange={(e) => setBookmarkTags(e.target.value)}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: '#f8fafc',
                      '&:hover fieldset': { borderColor: '#3b82f6' },
                      '&.Mui-focused fieldset': { borderColor: '#3b82f6' }
                    }
                  }}
                />
                <Button
                  type="submit"
                  variant="contained"
                  disabled={isLoading}
                  startIcon={<Add />}
                  sx={{
                    alignSelf: 'flex-start',
                    px: 3,
                    py: 1,
                    backgroundColor: '#3b82f6',
                    '&:hover': { backgroundColor: '#2563eb' }
                  }}
                >
                  {isLoading ? 'Adding...' : 'Add Bookmark'}
                </Button>
              </Stack>
            </Box>
          </Paper>

          {/* Search & Filter Section */}
          <Paper elevation={0} sx={{ p: 3, mb: 4, border: '1px solid #e2e8f0' }}>
            <Typography variant="h5" sx={{ mb: 3, fontWeight: 600, color: '#1e293b' }}>
              Search & Filter
            </Typography>

            <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
              <TextField
                fullWidth
                placeholder="Search bookmarks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: <Search sx={{ mr: 1, color: '#64748b' }} />
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: '#f8fafc',
                    '&:hover fieldset': { borderColor: '#3b82f6' },
                    '&.Mui-focused fieldset': { borderColor: '#3b82f6' }
                  }
                }}
              />
              {(searchTerm || selectedTag) && (
                <Button
                  onClick={clearSearch}
                  variant="outlined"
                  sx={{
                    whiteSpace: 'nowrap',
                    borderColor: '#d1d5db',
                    color: '#6b7280',
                    '&:hover': { borderColor: '#9ca3af', backgroundColor: '#f9fafb' }
                  }}
                >
                  Clear
                </Button>
              )}
            </Stack>

            {selectedTag && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" component="span" sx={{ mr: 1, color: '#64748b' }}>
                  Filtered by tag:
                </Typography>
                <Chip
                  label={selectedTag}
                  size="small"
                  sx={{
                    backgroundColor: '#dbeafe',
                    color: '#1d4ed8',
                    fontWeight: 500
                  }}
                />
              </Box>
            )}

            {allTags.length > 0 && (
              <Box>
                <Typography variant="h6" sx={{ mb: 1, fontWeight: 600, color: '#1e293b' }}>
                  Popular Tags:
                </Typography>
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                  {allTags.slice(0, 3).map((tag, index) => (
                    <Chip
                      key={index}
                      label={tag}
                      onClick={() => filterByTag(tag)}
                      variant={selectedTag === tag ? 'filled' : 'outlined'}
                      sx={{
                        backgroundColor: selectedTag === tag ? '#3b82f6' : 'transparent',
                        color: selectedTag === tag ? 'white' : '#3b82f6',
                        borderColor: '#3b82f6',
                        fontWeight: 500,
                        '&:hover': {
                          backgroundColor: selectedTag === tag ? '#2563eb' : '#eff6ff'
                        }
                      }}
                    />
                  ))}
                </Stack>
              </Box>
            )}
          </Paper>

          {/* Bookmarks List Section */}
          <Paper elevation={0} sx={{ border: '1px solid #e2e8f0' }}>
            <Box sx={{ p: 3, pb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                <Typography variant="h5" sx={{ fontWeight: 600, color: '#1e293b' }}>
                  Your Bookmarks ({bookmarks.length})
                </Typography>
                {bookmarks.length > 0 && (
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ color: '#64748b', mr: 1 }}>
                      Quality:
                    </Typography>
                    {(() => {
                      const qualityStats = bookmarks.reduce((acc, bookmark) => {
                        const quality = getMetadataQuality(bookmark);
                        if (quality.score === 3) acc.excellent++;
                        else if (quality.score === 2) acc.good++;
                        else if (quality.score === 1) acc.fair++;
                        else acc.poor++;
                        return acc;
                      }, { excellent: 0, good: 0, fair: 0, poor: 0 });

                      return (
                        <Stack direction="row" spacing={0.5}>
                          {qualityStats.excellent > 0 && (
                            <Chip
                              label={`${qualityStats.excellent} Excellent`}
                              size="small"
                              sx={{
                                backgroundColor: '#dcfce7',
                                color: '#16a34a',
                                fontSize: '11px',
                                height: '24px'
                              }}
                            />
                          )}
                          {qualityStats.good > 0 && (
                            <Chip
                              label={`${qualityStats.good} Good`}
                              size="small"
                              sx={{
                                backgroundColor: '#dbeafe',
                                color: '#2563eb',
                                fontSize: '11px',
                                height: '24px'
                              }}
                            />
                          )}
                          {qualityStats.fair > 0 && (
                            <Chip
                              label={`${qualityStats.fair} Fair`}
                              size="small"
                              sx={{
                                backgroundColor: '#fef3c7',
                                color: '#d97706',
                                fontSize: '11px',
                                height: '24px'
                              }}
                            />
                          )}
                          {qualityStats.poor > 0 && (
                            <Chip
                              label={`${qualityStats.poor} Poor`}
                              size="small"
                              sx={{
                                backgroundColor: '#fee2e2',
                                color: '#dc2626',
                                fontSize: '11px',
                                height: '24px'
                              }}
                            />
                          )}
                        </Stack>
                      );
                    })()}
                  </Box>
                )}
              </Box>
            </Box>
            {bookmarks.length === 0 ? (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant="body1" sx={{ color: '#64748b' }}>
                  No bookmarks yet. Add your first bookmark above!
                </Typography>
              </Box>
            ) : (
              <Box sx={{ height: 500, width: '100%', overflow: 'auto' }}>
                <DataGrid
                  rows={bookmarks}
                  columns={columns}
                  initialState={{
                    pagination: {
                      paginationModel: { page: 0, pageSize: 5 }
                    }
                  }}
                  pageSizeOptions={[5, 10, 25]}
                  disableRowSelectionOnClick
                  experimentalFeatures={{ newEditingApi: true }}
                  processRowUpdate={processRowUpdate}
                  onProcessRowUpdateError={(error) => {
                    console.error('Error updating row:', error);
                  }}
                  columnResizeMode="onChange"
                  sx={{
                    '& .MuiDataGrid-cell': {
                      padding: '0 16px',
                      display: 'flex',
                      alignItems: 'center',
                      borderBottom: 'none !important',
                      whiteSpace: 'normal',
                      wordBreak: 'break-word',
                      overflow: 'visible',
                    },
                    '& .MuiDataGrid-row': {
                      minHeight: '100px !important',
                      borderBottom: '1px solid #e2e8f0',
                      '&:hover': {
                        backgroundColor: '#f8fafc'
                      },
                      '&:last-child': {
                        borderBottom: 'none'
                      }
                    },
                    '& .MuiDataGrid-columnSeparator': {
                      visibility: 'visible !important',
                      color: '#e2e8f0'
                    },
                    '& .MuiDataGrid-columnHeaders': {
                      borderBottom: '2px solid #e2e8f0',
                      backgroundColor: '#f8fafc',
                      '& .MuiDataGrid-columnHeaderTitle': {
                        fontWeight: 600,
                        color: '#374151'
                      }
                    },
                    '& .MuiDataGrid-columnHeader': {
                      '&:hover .MuiDataGrid-columnSeparator': {
                        visibility: 'visible',
                        color: '#3b82f6'
                      }
                    },
                    '& .MuiDataGrid-virtualScroller': {
                      backgroundColor: '#ffffff'
                    }
                  }}
                />
              </Box>
            )}
          </Paper>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{
      backgroundColor: '#f8fafc',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <Container maxWidth="sm">
        <Paper elevation={0} sx={{
          p: 6,
          textAlign: 'center',
          backgroundColor: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: 2
        }}>
          <Box sx={{ mb: 4 }}>
            <Bookmark sx={{ fontSize: 48, color: '#3b82f6', mb: 2 }} />
            <Typography variant="h3" component="h1" sx={{
              fontWeight: 700,
              color: '#1e293b',
              mb: 1
            }}>
              LinkVault
            </Typography>
            <Typography variant="body1" sx={{
              color: '#64748b',
              fontSize: '1.1rem',
              mb: 1
            }}>
              Smart Bookmark Manager
            </Typography>
            <Typography variant="body2" sx={{
              color: '#64748b',
              fontSize: '0.9rem'
            }}>
              {isSignupMode ? 'Create your account to get started' : 'Sign in to your account'}
            </Typography>
          </Box>

          <Box component="form" onSubmit={isSignupMode ? handleSignup : handleLogin} sx={{ mt: 4 }}>
            {isSignupMode && (
              <TextField
                fullWidth
                label="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                sx={{
                  mb: 3,
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: '#f8fafc',
                    '&:hover fieldset': { borderColor: '#3b82f6' },
                    '&.Mui-focused fieldset': { borderColor: '#3b82f6' }
                  }
                }}
              />
            )}
            <TextField
              fullWidth
              type="email"
              label="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              sx={{
                mb: 3,
                '& .MuiOutlinedInput-root': {
                  backgroundColor: '#f8fafc',
                  '&:hover fieldset': { borderColor: '#3b82f6' },
                  '&.Mui-focused fieldset': { borderColor: '#3b82f6' }
                }
              }}
            />
            <TextField
              fullWidth
              type="password"
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              sx={{
                mb: 4,
                '& .MuiOutlinedInput-root': {
                  backgroundColor: '#f8fafc',
                  '&:hover fieldset': { borderColor: '#3b82f6' },
                  '&.Mui-focused fieldset': { borderColor: '#3b82f6' }
                }
              }}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              disabled={isLoading}
              sx={{
                py: 1.5,
                fontSize: '1rem',
                fontWeight: 600,
                backgroundColor: '#3b82f6',
                '&:hover': { backgroundColor: '#2563eb' },
                '&:disabled': { backgroundColor: '#94a3b8' }
              }}
            >
              {isLoading
                ? (isSignupMode ? 'Creating Account...' : 'Signing in...')
                : (isSignupMode ? 'Create Account' : 'Sign In')
              }
            </Button>
          </Box>

          {/* Toggle between Login and Signup */}
          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <Typography variant="body2" sx={{ color: '#64748b', mb: 1 }}>
              {isSignupMode ? 'Already have an account?' : "Don't have an account?"}
            </Typography>
            <Button
              onClick={() => {
                setIsSignupMode(!isSignupMode);
                setMessage('');
                setEmail('');
                setPassword('');
                setName('');
              }}
              variant="text"
              sx={{
                color: '#3b82f6',
                fontWeight: 600,
                '&:hover': { backgroundColor: '#eff6ff' }
              }}
            >
              {isSignupMode ? 'Sign In' : 'Create Account'}
            </Button>
          </Box>

          {message && (
            <Alert severity="error" sx={{ mt: 3, textAlign: 'left' }}>
              {message}
            </Alert>
          )}
        </Paper>
      </Container>
    </Box>
  )
}

export default App
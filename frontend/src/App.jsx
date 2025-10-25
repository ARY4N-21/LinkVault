import { useEffect, useState, useRef } from 'react'
import { DataGrid } from '@mui/x-data-grid';
import { Box, Button, Chip, Stack, Container, Paper, TextField, Typography, AppBar, Toolbar, IconButton, Alert, Tooltip } from '@mui/material';
import { Search, Add, Logout, Bookmark } from '@mui/icons-material';
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

  const columns = [
    {
      field: 'title',
      headerName: 'Title',
      width: 300,
      minWidth: 200,
      flex: 1,
      editable: true,
      renderCell: (params) => {
        if (!params.value && !params.row.url) return 'No Title';
        return (
          <Box sx={{ width: '100%' }}>
            <Box sx={{ marginBottom: '4px' }}>
              <a
                href={params.row.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: '#0066cc',
                  textDecoration: 'none',
                  fontSize: '14px',
                  display: 'block',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
                onMouseOver={(e) => e.target.style.textDecoration = 'underline'}
                onMouseOut={(e) => e.target.style.textDecoration = 'none'}
                title={params.value || 'No Title'} // Tooltip for full title
              >
                {params.value || 'No Title'}
              </a>
            </Box>
            {renderTags(params.row.tags)}
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
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
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
              fontSize: '13px'
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
            overflow: 'hidden'
          }}
          title={params.value} // Tooltip for full tags
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
          return 'No Date';
        }

        try {
          return new Date(dateValue).toLocaleString();
        } catch (error) {
          console.error('Date formatting error:', error);
          return 'Invalid Date';
        }
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
          tags: newRow.tags
        })
      });

      const data = await res.json();
      if (data.success) {
        fetchBookmarks(searchTerm, selectedTag);
        fetchAllTags();
        setPopup({ type: 'success', message: 'Bookmark updated successfully!' });
        setTimeout(() => setPopup(null), 3000);
        return newRow;
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
              <Typography variant="h5" sx={{ fontWeight: 600, color: '#1e293b' }}>
                Your Bookmarks ({bookmarks.length})
              </Typography>
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
                    padding: '8px 16px',
                    alignItems: 'flex-start',
                    borderBottom: 'none !important',
                    whiteSpace: 'normal',
                    wordBreak: 'break-word',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  },
                  '& .MuiDataGrid-row': {
                    minHeight: '80px !important',
                    borderBottom: '1px solid #f0f0f0'
                  },
                  '& .MuiDataGrid-columnSeparator': {
                    visibility: 'visible !important',
                    color: '#e0e0e0'
                  },
                  '& .MuiDataGrid-columnHeaders': {
                    borderBottom: '2px solid #e0e0e0'
                  },
                  '& .MuiDataGrid-columnHeader': {
                    '&:hover .MuiDataGrid-columnSeparator': {
                      visibility: 'visible',
                      color: '#3b82f6'
                    }
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
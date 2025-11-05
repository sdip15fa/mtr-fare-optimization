import React, { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  Tabs,
  Tab,
  Chip,
  Button,
  Stack,
  InputAdornment,
  IconButton,
  Typography,
  Paper,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import TrainIcon from '@mui/icons-material/Train';
import { MTR_LINES, getLinesForStation } from '../data/mtrLines';

interface StationSelectorProps {
  value: string | null;
  onChange: (station: string | null) => void;
  label: string;
  excludeStation?: string | null; // Optional: exclude a station from selection
}

const StationSelector: React.FC<StationSelectorProps> = ({
  value,
  onChange,
  label,
  excludeStation,
}) => {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [selectedLineId, setSelectedLineId] = useState<string>(MTR_LINES[0].id);
  const [searchQuery, setSearchQuery] = useState('');

  const currentLanguage = i18n.language.startsWith('zh') ? 'zh' : 'en';

  // Get translated station name
  const getStationName = useCallback((station: string) => {
    return t(`stations.${station}`, station);
  }, [t]);

  // Get display value for the text field
  const displayValue = value ? getStationName(value) : '';

  // Filter stations based on search query
  const filteredStations = useMemo(() => {
    if (!searchQuery.trim()) return null;

    const query = searchQuery.toLowerCase();
    const results: { station: string; lines: typeof MTR_LINES }[] = [];

    MTR_LINES.forEach(line => {
      line.stations.forEach(station => {
        const stationName = getStationName(station).toLowerCase();
        const englishName = station.toLowerCase();

        if (
          stationName.includes(query) ||
          englishName.includes(query)
        ) {
          // Check if station is already in results
          const existing = results.find(r => r.station === station);
          if (existing) {
            if (!existing.lines.find(l => l.id === line.id)) {
              existing.lines.push(line);
            }
          } else {
            results.push({ station, lines: [line] });
          }
        }
      });
    });

    return results;
  }, [searchQuery, getStationName]);

  const handleOpen = () => {
    setOpen(true);
    setSearchQuery('');
  };

  const handleClose = () => {
    setOpen(false);
    setSearchQuery('');
  };

  const handleStationSelect = (station: string) => {
    onChange(station);
    handleClose();
  };

  const handleClear = () => {
    onChange(null);
  };

  const selectedLine = MTR_LINES.find(line => line.id === selectedLineId) || MTR_LINES[0];

  return (
    <>
      <TextField
        fullWidth
        label={label}
        value={displayValue}
        onClick={handleOpen}
        InputProps={{
          readOnly: true,
          startAdornment: (
            <InputAdornment position="start">
              <TrainIcon color="action" />
            </InputAdornment>
          ),
          endAdornment: value ? (
            <InputAdornment position="end">
              <IconButton size="small" onClick={handleClear} edge="end">
                <ClearIcon />
              </IconButton>
            </InputAdornment>
          ) : null,
        }}
        sx={{
          cursor: 'pointer',
          '& .MuiInputBase-root': {
            cursor: 'pointer',
          },
        }}
      />

      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            height: '80vh',
            maxHeight: '700px',
          },
        }}
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="h6">{label}</Typography>
            <Button onClick={handleClose} size="small">
              {t('close', 'Close')}
            </Button>
          </Stack>
        </DialogTitle>

        <DialogContent dividers sx={{ p: 0 }}>
          {/* Search Bar */}
          <Box sx={{ p: 2, borderBottom: '1px solid rgba(0, 0, 0, 0.12)' }}>
            <TextField
              fullWidth
              placeholder={t('searchStations', 'Search stations...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
                endAdornment: searchQuery ? (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setSearchQuery('')}>
                      <ClearIcon />
                    </IconButton>
                  </InputAdornment>
                ) : null,
              }}
              autoFocus
            />
          </Box>

          {/* Search Results or Line Tabs */}
          {filteredStations ? (
            <Box sx={{ p: 2 }}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
                {filteredStations.length} {t('stationsFound', 'station(s) found')}
              </Typography>
              <Stack spacing={1}>
                {filteredStations.map(({ station, lines }) => (
                  <Paper
                    key={station}
                    elevation={0}
                    sx={{
                      p: 2,
                      border: '1px solid rgba(0, 0, 0, 0.12)',
                      cursor: station === excludeStation ? 'not-allowed' : 'pointer',
                      opacity: station === excludeStation ? 0.5 : 1,
                      '&:hover': {
                        backgroundColor: station === excludeStation ? 'transparent' : 'rgba(0, 0, 0, 0.04)',
                      },
                    }}
                    onClick={() => {
                      if (station !== excludeStation) {
                        handleStationSelect(station);
                      }
                    }}
                  >
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                      <Typography variant="body1" fontWeight={500}>
                        {getStationName(station)}
                      </Typography>
                      <Stack direction="row" spacing={0.5}>
                        {lines.map(line => (
                          <Chip
                            key={line.id}
                            label={currentLanguage === 'zh' ? line.nameZh : line.nameEn}
                            size="small"
                            sx={{
                              backgroundColor: line.color,
                              color: line.textColor,
                              fontWeight: 600,
                              fontSize: '0.7rem',
                            }}
                          />
                        ))}
                      </Stack>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            </Box>
          ) : (
            <>
              {/* Line Tabs */}
              <Tabs
                value={selectedLineId}
                onChange={(e, newValue) => setSelectedLineId(newValue)}
                variant="scrollable"
                scrollButtons="auto"
                sx={{
                  borderBottom: '1px solid rgba(0, 0, 0, 0.12)',
                  '& .MuiTab-root': {
                    minHeight: 60,
                    textTransform: 'none',
                    fontWeight: 600,
                  },
                }}
              >
                {MTR_LINES.map(line => (
                  <Tab
                    key={line.id}
                    value={line.id}
                    label={
                      <Box sx={{ textAlign: 'center' }}>
                        <Box
                          sx={{
                            width: 40,
                            height: 4,
                            backgroundColor: line.color,
                            borderRadius: 2,
                            mb: 0.5,
                            mx: 'auto',
                          }}
                        />
                        <Typography variant="body2" fontSize="0.75rem">
                          {currentLanguage === 'zh' ? line.nameZh : line.nameEn}
                        </Typography>
                      </Box>
                    }
                  />
                ))}
              </Tabs>

              {/* Station List */}
              <Box sx={{ p: 2 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    mb: 2,
                    pb: 1,
                    borderBottom: `3px solid ${selectedLine.color}`,
                  }}
                >
                  <Box
                    sx={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      backgroundColor: selectedLine.color,
                      mr: 1,
                    }}
                  />
                  <Typography variant="h6" fontWeight={600}>
                    {currentLanguage === 'zh' ? selectedLine.nameZh : selectedLine.nameEn}
                  </Typography>
                </Box>

                <Stack spacing={1}>
                  {selectedLine.branches ? (
                    // Line has branches - show branches first, then trunk
                    <>
                      {/* Branch divider */}
                      <Box sx={{ pl: 6, py: 1 }}>
                        <Typography variant="caption" color="text.secondary" fontWeight={600}>
                          {t('branchesTo', `Branches (merge at ${getStationName(selectedLine.branches.branchPoint)}):`)}
                        </Typography>
                      </Box>

                      {/* Each branch */}
                      {selectedLine.branches.branches.map((branch, branchIdx) => (
                        <Box key={`branch-${branchIdx}`} sx={{ pl: 4 }}>
                          <Typography variant="caption" color="text.secondary" sx={{ pl: 2, pb: 0.5, display: 'block' }}>
                            → {currentLanguage === 'zh' ? branch.nameZh : branch.name}
                          </Typography>
                          <Stack spacing={1}>
                            {branch.stations.map((station, stationIdx) => {
                              const isDisabled = station === excludeStation;
                              const stationLines = getLinesForStation(station);
                              const isInterchange = stationLines.length > 1;

                              return (
                                <Box
                                  key={`branch-${branchIdx}-${station}`}
                                  sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    position: 'relative',
                                  }}
                                >
                                  {/* Branch line connector */}
                                  {stationIdx < branch.stations.length - 1 && (
                                    <Box
                                      sx={{
                                        position: 'absolute',
                                        left: 15,
                                        top: 32,
                                        width: 3,
                                        height: 'calc(100% + 8px)',
                                        backgroundColor: selectedLine.color,
                                        opacity: 0.6,
                                      }}
                                    />
                                  )}

                                  {/* Station dot */}
                                  <Box
                                    sx={{
                                      width: 32,
                                      height: 32,
                                      borderRadius: '50%',
                                      backgroundColor: selectedLine.color,
                                      border: isInterchange ? `4px solid white` : 'none',
                                      boxShadow: isInterchange ? `0 0 0 2px ${selectedLine.color}` : 'none',
                                      opacity: 0.8,
                                      flexShrink: 0,
                                      mr: 2,
                                      zIndex: 1,
                                    }}
                                  />

                                  {/* Station button */}
                                  <Button
                                    fullWidth
                                    variant="outlined"
                                    disabled={isDisabled}
                                    onClick={() => handleStationSelect(station)}
                                    sx={{
                                      justifyContent: 'space-between',
                                      textTransform: 'none',
                                      fontWeight: 500,
                                      borderColor: selectedLine.color,
                                      borderStyle: 'dashed',
                                      borderWidth: 2,
                                      color: 'text.primary',
                                      backgroundColor: `${selectedLine.color}08`,
                                      '&:hover': {
                                        backgroundColor: `${selectedLine.color}20`,
                                        borderColor: selectedLine.color,
                                      },
                                      '&.Mui-disabled': {
                                        borderColor: 'rgba(0, 0, 0, 0.12)',
                                        color: 'text.disabled',
                                      },
                                    }}
                                  >
                                    <span>{getStationName(station)}</span>
                                    {isInterchange && (
                                      <Stack direction="row" spacing={0.5}>
                                        {stationLines
                                          .filter(l => l.id !== selectedLineId)
                                          .slice(0, 2)
                                          .map(line => (
                                            <Box
                                              key={line.id}
                                              sx={{
                                                width: 8,
                                                height: 8,
                                                borderRadius: '50%',
                                                backgroundColor: line.color,
                                              }}
                                            />
                                          ))}
                                      </Stack>
                                    )}
                                  </Button>
                                </Box>
                              );
                            })}
                          </Stack>
                        </Box>
                      ))}

                      {/* Trunk stations (after branch point) */}
                      {selectedLine.branches.trunk.map((station, index) => {
                        const isDisabled = station === excludeStation;
                        const stationLines = getLinesForStation(station);
                        const isInterchange = stationLines.length > 1;
                        const isBranchPoint = station === selectedLine.branches!.branchPoint;

                        return (
                          <Box
                            key={`trunk-${station}`}
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              position: 'relative',
                            }}
                          >
                            {/* Line connector */}
                            {index < selectedLine.branches!.trunk.length - 1 && (
                              <Box
                                sx={{
                                  position: 'absolute',
                                  left: 15,
                                  top: 32,
                                  width: 3,
                                  height: 'calc(100% + 8px)',
                                  backgroundColor: selectedLine.color,
                                }}
                              />
                            )}

                            {/* Station dot */}
                            <Box
                              sx={{
                                width: 32,
                                height: 32,
                                borderRadius: '50%',
                                backgroundColor: selectedLine.color,
                                border: isInterchange ? `4px solid white` : 'none',
                                boxShadow: isInterchange ? `0 0 0 2px ${selectedLine.color}` : 'none',
                                flexShrink: 0,
                                mr: 2,
                                zIndex: 1,
                              }}
                            />

                            {/* Station button */}
                            <Button
                              fullWidth
                              variant="outlined"
                              disabled={isDisabled}
                              onClick={() => handleStationSelect(station)}
                              sx={{
                                justifyContent: 'space-between',
                                textTransform: 'none',
                                fontWeight: 500,
                                borderColor: 'rgba(0, 0, 0, 0.12)',
                                color: 'text.primary',
                                '&:hover': {
                                  backgroundColor: `${selectedLine.color}15`,
                                  borderColor: selectedLine.color,
                                },
                                '&.Mui-disabled': {
                                  borderColor: 'rgba(0, 0, 0, 0.12)',
                                  color: 'text.disabled',
                                },
                              }}
                            >
                              <span>
                                {getStationName(station)}
                                {isBranchPoint && ' ⑂'}
                              </span>
                              {isInterchange && (
                                <Stack direction="row" spacing={0.5}>
                                  {stationLines
                                    .filter(l => l.id !== selectedLineId)
                                    .slice(0, 2)
                                    .map(line => (
                                      <Box
                                        key={line.id}
                                        sx={{
                                          width: 8,
                                          height: 8,
                                          borderRadius: '50%',
                                          backgroundColor: line.color,
                                        }}
                                      />
                                    ))}
                                </Stack>
                              )}
                            </Button>
                          </Box>
                        );
                      })}
                    </>
                  ) : (
                    // No branches - show all stations normally
                    selectedLine.stations.map((station, index) => {
                      const isDisabled = station === excludeStation;
                      const stationLines = getLinesForStation(station);
                      const isInterchange = stationLines.length > 1;

                      return (
                        <Box
                          key={station}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            position: 'relative',
                          }}
                        >
                          {/* Line connector */}
                          {index < selectedLine.stations.length - 1 && (
                            <Box
                              sx={{
                                position: 'absolute',
                                left: 15,
                                top: 32,
                                width: 3,
                                height: 'calc(100% + 8px)',
                                backgroundColor: selectedLine.color,
                              }}
                            />
                          )}

                          {/* Station dot */}
                          <Box
                            sx={{
                              width: 32,
                              height: 32,
                              borderRadius: '50%',
                              backgroundColor: selectedLine.color,
                              border: isInterchange ? `4px solid white` : 'none',
                              boxShadow: isInterchange ? `0 0 0 2px ${selectedLine.color}` : 'none',
                              flexShrink: 0,
                              mr: 2,
                              zIndex: 1,
                            }}
                          />

                          {/* Station button */}
                          <Button
                            fullWidth
                            variant="outlined"
                            disabled={isDisabled}
                            onClick={() => handleStationSelect(station)}
                            sx={{
                              justifyContent: 'space-between',
                              textTransform: 'none',
                              fontWeight: 500,
                              borderColor: 'rgba(0, 0, 0, 0.12)',
                              color: 'text.primary',
                              '&:hover': {
                                backgroundColor: `${selectedLine.color}15`,
                                borderColor: selectedLine.color,
                              },
                              '&.Mui-disabled': {
                                borderColor: 'rgba(0, 0, 0, 0.12)',
                                color: 'text.disabled',
                              },
                            }}
                          >
                            <span>{getStationName(station)}</span>
                            {isInterchange && (
                              <Stack direction="row" spacing={0.5}>
                                {stationLines
                                  .filter(l => l.id !== selectedLineId)
                                  .slice(0, 2)
                                  .map(line => (
                                    <Box
                                      key={line.id}
                                      sx={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: '50%',
                                        backgroundColor: line.color,
                                      }}
                                    />
                                  ))}
                              </Stack>
                            )}
                          </Button>
                        </Box>
                      );
                    })
                  )}
                </Stack>
              </Box>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default StationSelector;

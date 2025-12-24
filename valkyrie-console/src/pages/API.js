import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Alert,
  Card,
  CardContent,
  Grid,
  Button,
  TextField,
  IconButton,
  Tooltip,
  CircularProgress
} from '@mui/material';
import {
  ExpandMore,
  ContentCopy,
  CheckCircle,
  Code,
  Lock,
  Send,
  GetApp,
  PostAdd
} from '@mui/icons-material';
import { api } from '../services/valkyrieApi';
// Temporarily disable syntax highlighter to fix import issue
// import { Prism } from 'react-syntax-highlighter';
// import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

const API = () => {
  const [partnerInfo, setPartnerInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState({});
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [apiKey, setApiKey] = useState(null);
  const [maskedApiKey, setMaskedApiKey] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [newApiKey, setNewApiKey] = useState(null);

  useEffect(() => {
    fetchPartnerInfo();
  }, []);

  const fetchPartnerInfo = async () => {
    try {
      const response = await api.get('/partner');
      if (response.data.success) {
        const partner = response.data.partner;
        setPartnerInfo({ 
          user: JSON.parse(localStorage.getItem('valkyrieUser') || '{}'),
          partner: partner 
        });
        // Set the masked API key if it exists
        if (partner.apiKey) {
          setMaskedApiKey(partner.apiKey); // This is already masked from the API
        }
      }
    } catch (error) {
      console.error('Failed to fetch partner info:', error);
      // Fallback to localStorage
      const user = JSON.parse(localStorage.getItem('valkyrieUser') || '{}');
      const partner = JSON.parse(localStorage.getItem('valkyriePartner') || '{}');
      setPartnerInfo({ user, partner });
    } finally {
      setLoading(false);
    }
  };


  const generateApiKey = async () => {
    if (maskedApiKey && !window.confirm('Generating a new API key will invalidate your current key. Are you sure you want to continue?')) {
      return;
    }

    setGenerating(true);
    try {
      const response = await api.post('/partner/api-key');
      if (response.data.success) {
        setNewApiKey(response.data.apiKey);
        setMaskedApiKey(response.data.maskedApiKey);
        // Refresh partner info to get updated data
        await fetchPartnerInfo();
        // Show success message
        alert('API key generated successfully! Please copy it now - it will not be shown again.');
      }
    } catch (error) {
      console.error('Failed to generate API key:', error);
      alert('Failed to generate API key. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopied({ ...copied, [id]: true });
    setTimeout(() => {
      setCopied({ ...copied, [id]: false });
    }, 2000);
  };

  const baseUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5001/api/valkyrie/v1'
    : 'https://dialadrink-backend-910510650031.us-central1.run.app/api/valkyrie/v1';

  const CodeBlock = ({ code, language = 'json', id }) => (
    <Box sx={{ position: 'relative', mb: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
        <Tooltip title={copied[id] ? 'Copied!' : 'Copy to clipboard'}>
          <IconButton
            size="small"
            onClick={() => copyToClipboard(code, id)}
            sx={{ color: 'text.secondary' }}
          >
            {copied[id] ? <CheckCircle fontSize="small" /> : <ContentCopy fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Box>
      <Box
        component="pre"
        sx={{
          backgroundColor: '#1e1e1e',
          color: '#d4d4d4',
          padding: '16px',
          borderRadius: '4px',
          overflow: 'auto',
          fontFamily: 'monospace',
          fontSize: '0.875rem',
          lineHeight: 1.5,
          margin: 0
        }}
      >
        <Box component="code">{code}</Box>
      </Box>
    </Box>
  );

  const EndpointSection = ({ method, path, title, description, requestBody, response, params, auth = true }) => {
    return (
    <Accordion sx={{ mb: 2 }}>
      <AccordionSummary expandIcon={<ExpandMore />}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
          <Chip
            label={method}
            color={method === 'GET' ? 'primary' : method === 'POST' ? 'success' : method === 'PATCH' ? 'warning' : 'error'}
            size="small"
            sx={{ fontWeight: 'bold', minWidth: '60px' }}
          />
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            {title}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>
            {path}
          </Typography>
        </Box>
      </AccordionSummary>
      <AccordionDetails>
        <Box>
          <Typography variant="body1" paragraph>
            {description}
          </Typography>

          <Typography variant="h6" gutterBottom sx={{ mt: 3, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Code fontSize="small" /> Endpoint URL
          </Typography>
          <CodeBlock
            code={`${baseUrl}${path}`}
            language="text"
            id={`url-${path}`}
          />

          {auth && (
            <>
              <Typography variant="h6" gutterBottom sx={{ mt: 3, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Lock fontSize="small" /> Authentication Required
              </Typography>
              <Alert severity="info" sx={{ mb: 2 }}>
                This endpoint requires authentication. Include your API key or JWT token in the request headers.
              </Alert>
            </>
          )}

          {params && (
            <>
              <Typography variant="h6" gutterBottom sx={{ mt: 3, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <GetApp fontSize="small" /> Query Parameters
              </Typography>
              <Box component="table" sx={{ width: '100%', mb: 2, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e0e0e0' }}>
                    <th style={{ textAlign: 'left', padding: '8px' }}>Parameter</th>
                    <th style={{ textAlign: 'left', padding: '8px' }}>Type</th>
                    <th style={{ textAlign: 'left', padding: '8px' }}>Required</th>
                    <th style={{ textAlign: 'left', padding: '8px' }}>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {params.map((param, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '8px', fontFamily: 'monospace' }}>{param.name}</td>
                      <td style={{ padding: '8px' }}>{param.type}</td>
                      <td style={{ padding: '8px' }}>{param.required ? 'Yes' : 'No'}</td>
                      <td style={{ padding: '8px' }}>{param.description}</td>
                    </tr>
                  ))}
                </tbody>
              </Box>
            </>
          )}

          {requestBody && (
            <>
              <Typography variant="h6" gutterBottom sx={{ mt: 3, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <PostAdd fontSize="small" /> Request Body
              </Typography>
              <CodeBlock
                code={JSON.stringify(requestBody, null, 2)}
                language="json"
                id={`request-${path}`}
              />
            </>
          )}

          {response && (
            <>
              <Typography variant="h6" gutterBottom sx={{ mt: 3, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Send fontSize="small" /> Sample Response
              </Typography>
              <CodeBlock
                code={JSON.stringify(response, null, 2)}
                language="json"
                id={`response-${path}`}
              />
            </>
          )}

          <Typography variant="h6" gutterBottom sx={{ mt: 3, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Code fontSize="small" /> cURL Example
          </Typography>
          <CodeBlock
            code={generateCurlExample(method, path, requestBody, auth)}
            language="bash"
            id={`curl-${path}`}
          />
        </Box>
      </AccordionDetails>
    </Accordion>
    );
  };

  const generateCurlExample = (method, path, body, auth) => {
    const url = `${baseUrl}${path}`;
    let curl = `curl -X ${method} "${url}" \\\n`;
    curl += `  -H "Content-Type: application/json" \\\n`;
    if (auth) {
      curl += `  -H "Authorization: Bearer YOUR_API_KEY_OR_JWT_TOKEN" \\\n`;
    }
    if (body && (method === 'POST' || method === 'PATCH')) {
      curl += `  -d '${JSON.stringify(body)}'`;
    }
    return curl;
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, textAlign: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', mb: 1 }}>
        Valkyrie Partner API
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Integrate your systems with DeliveryOS to create orders, manage drivers, and track deliveries programmatically.
      </Typography>

      <Divider sx={{ my: 4 }} />

      {/* Authentication Section */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', mb: 2 }}>
          Authentication
        </Typography>
        <Typography variant="body1" paragraph>
          Valkyrie supports two authentication methods:
        </Typography>

        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  API Key (Programmatic Access)
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  Use your API key for server-to-server integration. Get your API key from your partner dashboard.
                </Typography>
                <CodeBlock
                  code={`X-API-Key: your-api-key-here\n\nOR\n\nAuthorization: Bearer your-api-key-here`}
                  language="text"
                  id="api-key-header"
                />
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  JWT Token (Console Access)
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  Authenticate via email/password to get a JWT token for console access.
                </Typography>
                <CodeBlock
                  code={`Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`}
                  language="text"
                  id="jwt-header"
                />
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* API Key Management Section */}
        <Card sx={{ mb: 3, bgcolor: 'background.paper' }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" gutterBottom>
                Your API Key
              </Typography>
              <Button
                variant="contained"
                color="primary"
                onClick={generateApiKey}
                disabled={generating}
                startIcon={!generating && <Lock />}
              >
                {generating ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CircularProgress size={16} color="inherit" />
                    Generating...
                  </Box>
                ) : (
                  maskedApiKey ? 'Regenerate API Key' : 'Generate API Key'
                )}
              </Button>
            </Box>
            
            {newApiKey && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                <Typography variant="body2" gutterBottom>
                  <strong>Important:</strong> Copy your API key now. It will not be shown again.
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                  <TextField
                    fullWidth
                    value={newApiKey}
                    InputProps={{
                      readOnly: true,
                      sx: { fontFamily: 'monospace', fontSize: '0.875rem' }
                    }}
                    size="small"
                  />
                  <Tooltip title={copied['new-api-key'] ? 'Copied!' : 'Copy to clipboard'}>
                    <IconButton
                      onClick={() => copyToClipboard(newApiKey, 'new-api-key')}
                      color="primary"
                    >
                      {copied['new-api-key'] ? <CheckCircle /> : <ContentCopy />}
                    </IconButton>
                  </Tooltip>
                </Box>
              </Alert>
            )}

            {maskedApiKey && !newApiKey && (
              <Box>
                <Alert severity="info" sx={{ mb: 2 }}>
                  <Typography variant="body2" gutterBottom>
                    <strong>Your Sandbox API Key</strong>
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    This is the API key that was generated when you signed up for sandbox access. Use it to authenticate your API requests.
                  </Typography>
                </Alert>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Current API Key (first 4 characters shown):
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                  <TextField
                    fullWidth
                    value={maskedApiKey}
                    InputProps={{
                      readOnly: true,
                      sx: { fontFamily: 'monospace', fontSize: '0.875rem' }
                    }}
                    size="small"
                  />
                  <Tooltip title="Copy masked API key">
                    <IconButton
                      onClick={() => copyToClipboard(maskedApiKey, 'masked-api-key')}
                      color="primary"
                    >
                      {copied['masked-api-key'] ? <CheckCircle /> : <ContentCopy />}
                    </IconButton>
                  </Tooltip>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  Note: Only the first 4 characters are shown for security. The full API key was sent to your email when you signed up. Regenerate a new key if you need to see the full value.
                </Typography>
              </Box>
            )}

            {!maskedApiKey && !newApiKey && (
              <Alert severity="info">
                <Typography variant="body2">
                  You don't have an API key yet. Click "Generate API Key" to create one.
                </Typography>
              </Alert>
            )}
          </CardContent>
        </Card>

        <EndpointSection
          method="POST"
          path="/auth/token"
          title="Get Access Token"
          description="Authenticate and receive an access token (JWT or API key validation)."
          requestBody={{
            email: "admin@partner.com",
            password: "your-password"
          }}
          response={{
            success: true,
            token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
            user: {
              id: 1,
              email: "admin@partner.com",
              role: "admin"
            },
            partner: {
              id: 1,
              name: "Partner Company"
            },
            authType: "jwt"
          }}
          auth={false}
        />
      </Box>

      <Divider sx={{ my: 4 }} />

      {/* Orders Section */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', mb: 2 }}>
          Orders
        </Typography>

        <EndpointSection
          method="POST"
          path="/orders"
          title="Create Order"
          description="Create a new delivery order."
          requestBody={{
            customerName: "John Doe",
            customerPhone: "254712345678",
            customerEmail: "john@example.com",
            deliveryAddress: "123 Main St, Nairobi",
            latitude: -1.2921,
            longitude: 36.8219,
            items: [
              {
                drinkId: 1,
                quantity: 2,
                price: 500
              }
            ],
            totalAmount: 1000,
            tipAmount: 100,
            notes: "Handle with care",
            paymentType: "pay_on_delivery",
            paymentMethod: "cash",
            externalOrderId: "PARTNER-ORDER-123"
          }}
          response={{
            success: true,
            order: {
              id: 123,
              partnerOrderId: 1,
              customerName: "John Doe",
              status: "pending",
              totalAmount: 1000,
              createdAt: "2024-01-01T12:00:00Z"
            }
          }}
        />

        <EndpointSection
          method="GET"
          path="/orders"
          title="List Orders"
          description="Retrieve a list of your orders with optional filters."
          params={[
            { name: "status", type: "string", required: false, description: "Filter by status (pending, confirmed, delivered, etc.)" },
            { name: "limit", type: "number", required: false, description: "Results per page (default: 50, max: 100)" },
            { name: "offset", type: "number", required: false, description: "Pagination offset (default: 0)" },
            { name: "startDate", type: "string", required: false, description: "Filter orders from date (ISO 8601)" },
            { name: "endDate", type: "string", required: false, description: "Filter orders to date (ISO 8601)" }
          ]}
          response={{
            success: true,
            orders: [
              {
                id: 123,
                partnerOrderId: 1,
                customerName: "John Doe",
                status: "pending",
                totalAmount: 1000,
                assignedDriver: null,
                createdAt: "2024-01-01T12:00:00Z"
              }
            ],
            count: 1,
            total: 1
          }}
        />

        <EndpointSection
          method="GET"
          path="/orders/:id"
          title="Get Order Details"
          description="Get detailed information about a specific order."
          response={{
            success: true,
            order: {
              id: 123,
              partnerOrderId: 1,
              customerName: "John Doe",
              customerPhone: "254712345678",
              deliveryAddress: "123 Main St, Nairobi",
              totalAmount: 1000,
              status: "pending",
              paymentStatus: "pending",
              items: [
                {
                  id: 1,
                  drink: { id: 1, name: "Beer" },
                  quantity: 2,
                  price: 500
                }
              ],
              assignedDriver: null,
              createdAt: "2024-01-01T12:00:00Z"
            }
          }}
        />

        <EndpointSection
          method="POST"
          path="/orders/:id/request-driver"
          title="Request Driver Assignment"
          description="Request driver assignment for an order. Optionally specify a driver ID."
          requestBody={{
            driverId: 5,
            fulfillmentType: "partner_driver"
          }}
          response={{
            success: true,
            message: "Driver assigned successfully",
            driver: {
              id: 5,
              name: "Driver Name",
              phoneNumber: "254712345678",
              status: "active"
            },
            fulfillmentType: "partner_driver"
          }}
        />

        <EndpointSection
          method="GET"
          path="/orders/:id/driver"
          title="Get Assigned Driver"
          description="Get details of the driver assigned to an order."
          response={{
            success: true,
            driver: {
              id: 5,
              name: "Driver Name",
              phoneNumber: "254712345678",
              status: "active"
            },
            fulfillmentType: "partner_driver"
          }}
        />
      </Box>

      <Divider sx={{ my: 4 }} />

      {/* Drivers Section */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', mb: 2 }}>
          Drivers
        </Typography>

        <EndpointSection
          method="POST"
          path="/drivers"
          title="Add Partner Driver"
          description="Add a partner-owned driver to your fleet. Requires admin or ops role."
          requestBody={{
            driverId: 5
          }}
          response={{
            success: true,
            driver: {
              id: 5,
              name: "Driver Name",
              phoneNumber: "254712345678",
              status: "active",
              ownershipType: "partner_owned",
              active: true,
              partnerDriverId: 1
            }
          }}
        />

        <EndpointSection
          method="GET"
          path="/drivers"
          title="List Drivers"
          description="List all partner drivers (partner-owned and DeliveryOS eligible)."
          params={[
            { name: "active", type: "boolean", required: false, description: "Filter by active status" },
            { name: "ownershipType", type: "string", required: false, description: "Filter by ownership (partner_owned, deliveryos_owned)" },
            { name: "limit", type: "number", required: false, description: "Results per page (default: 50)" },
            { name: "offset", type: "number", required: false, description: "Pagination offset (default: 0)" }
          ]}
          response={{
            success: true,
            drivers: [
              {
                id: 5,
                name: "Driver Name",
                phoneNumber: "254712345678",
                status: "active",
                ownershipType: "partner_owned",
                active: true
              }
            ],
            count: 1
          }}
        />

        <EndpointSection
          method="PATCH"
          path="/drivers/:id/status"
          title="Update Driver Status"
          description="Activate or deactivate a partner-owned driver. Requires admin or ops role."
          requestBody={{
            active: true
          }}
          response={{
            success: true,
            message: "Driver activated successfully",
            driver: {
              id: 5,
              active: true
            }
          }}
        />
      </Box>

      <Divider sx={{ my: 4 }} />

      {/* Delivery Zones Section */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', mb: 2 }}>
          Delivery Zones
        </Typography>

        <EndpointSection
          method="GET"
          path="/zones"
          title="List Delivery Zones"
          description="Get all delivery zones configured for your partner account."
          response={{
            success: true,
            zones: [
              {
                id: 1,
                name: "Nairobi CBD",
                geometry: {
                  type: "Polygon",
                  coordinates: [[[-1.2921, 36.8219], [-1.3000, 36.8300], [-1.2800, 36.8300], [-1.2921, 36.8219]]]
                },
                source: "partner",
                active: true
              }
            ],
            count: 1
          }}
        />

        <EndpointSection
          method="POST"
          path="/zones"
          title="Create Delivery Zone"
          description="Create a new delivery zone. Zone must be within Zeus-defined boundaries. Requires admin or ops role."
          requestBody={{
            name: "Nairobi CBD",
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [-1.2921, 36.8219],
                  [-1.3000, 36.8300],
                  [-1.2800, 36.8300],
                  [-1.2921, 36.8219]
                ]
              ]
            },
            active: true
          }}
          response={{
            success: true,
            zone: {
              id: 1,
              name: "Nairobi CBD",
              geometry: {
                type: "Polygon",
                coordinates: [
                  [
                    [-1.2921, 36.8219],
                    [-1.3000, 36.8300],
                    [-1.2800, 36.8300],
                    [-1.2921, 36.8219]
                  ]
                ]
              },
              source: "partner",
              active: true
            }
          }}
        />

        <EndpointSection
          method="PATCH"
          path="/zones/:id"
          title="Update Delivery Zone"
          description="Update an existing delivery zone. Cannot update Zeus-managed zones. Requires admin or ops role."
          requestBody={{
            name: "Updated Zone Name",
            active: false
          }}
          response={{
            success: true,
            zone: {
              id: 1,
              name: "Updated Zone Name",
              active: false
            }
          }}
        />

        <EndpointSection
          method="DELETE"
          path="/zones/:id"
          title="Delete Delivery Zone"
          description="Delete a delivery zone. Cannot delete Zeus-managed zones. Requires admin or ops role."
          response={{
            success: true,
            message: "Zone deleted successfully"
          }}
        />
      </Box>

      <Divider sx={{ my: 4 }} />

      {/* Webhooks Section */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', mb: 2 }}>
          Webhooks
        </Typography>

        <EndpointSection
          method="GET"
          path="/webhooks"
          title="Get Webhook Configuration"
          description="Get your webhook URL and configuration."
          response={{
            success: true,
            webhook: {
              url: "https://partner.com/webhooks/valkyrie",
              configured: true,
              events: ["order.status.updated", "driver.assigned", "delivery.completed"]
            }
          }}
        />

        <Alert severity="info" sx={{ mt: 2 }}>
          <Typography variant="h6" gutterBottom>
            Webhook Events
          </Typography>
          <Typography variant="body2" component="div">
            <strong>order.status.updated</strong> - Triggered when an order status changes<br />
            <strong>driver.assigned</strong> - Triggered when a driver is assigned to an order<br />
            <strong>delivery.completed</strong> - Triggered when a delivery is completed
          </Typography>
        </Alert>
      </Box>

      <Divider sx={{ my: 4 }} />

      {/* Error Codes Section */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', mb: 2 }}>
          Response Codes
        </Typography>
        <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e0e0e0' }}>
              <th style={{ textAlign: 'left', padding: '8px' }}>Code</th>
              <th style={{ textAlign: 'left', padding: '8px' }}>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
              <td style={{ padding: '8px', fontFamily: 'monospace' }}>200</td>
              <td style={{ padding: '8px' }}>Successful Request</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
              <td style={{ padding: '8px', fontFamily: 'monospace' }}>201</td>
              <td style={{ padding: '8px' }}>Resource Created Successfully</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
              <td style={{ padding: '8px', fontFamily: 'monospace' }}>400</td>
              <td style={{ padding: '8px' }}>Bad Request - Invalid parameters</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
              <td style={{ padding: '8px', fontFamily: 'monospace' }}>401</td>
              <td style={{ padding: '8px' }}>Unauthorized - Invalid or missing authentication</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
              <td style={{ padding: '8px', fontFamily: 'monospace' }}>403</td>
              <td style={{ padding: '8px' }}>Forbidden - Insufficient permissions</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
              <td style={{ padding: '8px', fontFamily: 'monospace' }}>404</td>
              <td style={{ padding: '8px' }}>Not Found - Resource does not exist</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
              <td style={{ padding: '8px', fontFamily: 'monospace' }}>409</td>
              <td style={{ padding: '8px' }}>Conflict - Resource already exists</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
              <td style={{ padding: '8px', fontFamily: 'monospace' }}>500</td>
              <td style={{ padding: '8px' }}>Internal Server Error</td>
            </tr>
          </tbody>
        </Box>
      </Box>

      <Divider sx={{ my: 4 }} />

      {/* Support Section */}
      <Box sx={{ mb: 4, textAlign: 'center' }}>
        <Typography variant="h6" gutterBottom>
          Need Help?
        </Typography>
        <Typography variant="body2" color="text.secondary">
          For API support, contact: <strong>valkyrie-support@deliveryos.com</strong>
        </Typography>
      </Box>
    </Container>
  );
};

export default API;


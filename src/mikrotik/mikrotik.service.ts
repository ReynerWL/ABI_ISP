// src/mikrotik/mikrotik.service.ts
import { Injectable, Logger, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import axios, { AxiosInstance, AxiosBasicCredentials } from 'axios';
import { MikroTikUser } from './entities/mikrotik-user.entity';
import { MikroTikConnection } from './entities/mikrotik-connection.entity';
import { User, UserStatus } from '#/user/entities/user.entity'; // Adjust path
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class MikrotikService {
  private readonly logger = new Logger(MikrotikService.name);

  constructor(
    @InjectRepository(MikroTikUser)
    private readonly mikrotikUserRepository: Repository<MikroTikUser>,
    @InjectRepository(MikroTikConnection)
    private readonly mikrotikConnectionRepository: Repository<MikroTikConnection>,
    @InjectRepository(User) // If you need to fetch user details
    private readonly userRepository: Repository<User>,
  ) {}

  private async getActiveConnection(): Promise<MikroTikConnection> {
    const connection = await this.mikrotikConnectionRepository.findOne({
      where: { isActive: true },
    });
    if (!connection) {
      throw new InternalServerErrorException('No active MikroTik connection configured.');
    }
    return connection;
  }

 
  private async createApiClient(): Promise<AxiosInstance> {
    const connection = await this.getActiveConnection();
    const protocol = connection.port === 443 ? 'https' : 'http';
    const baseURL = `${protocol}://${connection.host}:${connection.port}/rest`;

    const auth: AxiosBasicCredentials = {
      username: connection.username,
      password: connection.password,
    };

    const api = axios.create({
      baseURL,
      auth,
      timeout: 10000, // 10 seconds
    });

    api.interceptors.request.use(request => {
      this.logger.debug('MikroTik API Request:', request.method?.toUpperCase(), request.url);
      return request;
    });
    api.interceptors.response.use(response => {
      this.logger.debug('MikroTik API Response:', response.status, response.config.url);
      return response;
    }, error => {
      this.logger.error('MikroTik API Error:', error.message);
      return Promise.reject(error);
    });

    return api;
  }

// src/mikrotik/mikrotik.service.ts

async testConnection(connectionId?: string): Promise<{ success: boolean; message: string }> {
  let connection: MikroTikConnection | null;
  try {
    if (connectionId) {
      connection = await this.mikrotikConnectionRepository.findOneBy({ id: connectionId });
      if (!connection) {
        throw new NotFoundException(`Connection with ID ${connectionId} not found.`);
      }
    } else {
      connection = await this.getActiveConnection();
    }

    // --- Determine Protocol ---
    // More robust protocol determination based on common ports
    let protocol: string;
    if (connection.port === 443 || connection.port === 8729) {
      protocol = 'https';
    } else if (connection.port === 80 || connection.port === 8728) {
      protocol = 'http';
    } else {
      // Default assumption, might be wrong. Log this.
      protocol = connection.port === 443 ? 'https' : 'http'; // Keep your existing logic as fallback
      this.logger.warn(`Uncommon port ${connection.port} detected. Assuming protocol: ${protocol}. Verify MikroTik service configuration.`);
    }

    const baseURL = `${protocol}://${connection.host}:${connection.port}/rest`;
    const auth: AxiosBasicCredentials = {
      username: connection.username,
      password: connection.password,
    };

    this.logger.debug(`Attempting to connect to MikroTik at ${baseURL} with user ${auth.username}`);

    // --- Perform the Request ---
    // Increased timeout for testing, consider making configurable
    const response = await axios.get(`${baseURL}/system/resource`, {
      auth,
      timeout: 15000, // Increased timeout to 15 seconds for testing
      // --- Handle Self-Signed Certificates (FOR TESTING ONLY!) ---
      // NEVER do this in production. Fix the cert properly.
      httpsAgent: new (require('https')).Agent({ rejectUnauthorized: false }), // Import 'https' at the top
      // --- Optional: Add better error logging ---
    });

    if (response.status === 200) {
      this.logger.log(`✅ Successfully connected to MikroTik at ${baseURL}`);
      return { success: true, message: 'Connection successful' };
    } else {
      const errorMsg = `Unexpected response status: ${response.status} - ${response.statusText}`;
      this.logger.warn(`⚠️ Unexpected response from MikroTik (${baseURL}): ${errorMsg}`);
      return { success: false, message: errorMsg };
    }
  } catch (error) {
    // --- Enhanced Error Logging ---
    let errorMessage = 'Unknown error';
    if (error.code) {
      errorMessage = `Network/System Error Code: ${error.code}`;
      // Common codes:
      // ECONNREFUSED: Connection refused (service down/port blocked)
      // ETIMEDOUT: Operation timed out (firewall/network)
      // ENOTFOUND: DNS lookup failed (wrong host?)
    } else if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      errorMessage = `HTTP Error ${error.response.status}: ${error.response.statusText}`;
      if (error.response.data) {
        errorMessage += ` - Details: ${JSON.stringify(error.response.data).substring(0, 200)}...`; // Truncate
      }
    } else if (error.request) {
      // The request was made but no response was received
      errorMessage = `No response received. Details: ${error.message}`;
    } else {
      // Something happened in setting up the request that triggered an Error
      errorMessage = `Request setup error: ${error.message}`;
    }

    this.logger.error(`❌ MikroTik connection test failed for ${ connection.host || 'unknown host'}:${connection?.port || 'unknown port'}`, errorMessage);
    return { success: false, message: `Connection failed: ${errorMessage}` };
  }
}


  async blockUserByUserId(userId: string): Promise<{ success: boolean; message: string }> {
    const mikrotikUser = await this.mikrotikUserRepository.findOne({
      where: { userId },
      relations: ['user'], // Load related User entity if needed
    });

    if (!mikrotikUser) {
      return { success: false, message: `MikroTik user mapping not found for user ID ${userId}` };
    }

    if (!mikrotikUser.isEnabled) {
      return { success: true, message: `User ${userId} is already blocked.` };
    }

    try {
      const api = await this.createApiClient();

      const disableResponse = await api.patch(`/ip/hotspot/user/${mikrotikUser.mikrotikUsername}`, {
        disabled: true,
      });

      if (disableResponse.status !== 200) {
        throw new Error(`Failed to disable user ${mikrotikUser.mikrotikUsername}`);
      }

      // 2. (Optional) Remove from active sessions
      // You might need to find and remove the user from `/ip/hotspot/active`
      // This often requires a separate lookup by username or IP.
      // const activeSessions = await api.get(`/ip/hotspot/active`, {
      //   params: { '.user': mikrotikUser.mikrotikUsername }
      // });
      // for (const session of activeSessions.data) {
      //   await api.delete(`/ip/hotspot/active/${session['.id']}`);
      // }

      // 3. Update local database
      mikrotikUser.isEnabled = false;
      await this.mikrotikUserRepository.save(mikrotikUser);

      this.logger.log(`Blocked MikroTik user ${mikrotikUser.mikrotikUsername} (App User ID: ${userId})`);
      return { success: true, message: `User ${userId} blocked successfully.` };
    } catch (error) {
      this.logger.error(`Failed to block user ${userId}`, error.stack);
      return { success: false, message: `Failed to block user: ${error.message}` };
    }
  }

  async unblockUserByUserId(userId: string): Promise<{ success: boolean; message: string }> {
    const mikrotikUser = await this.mikrotikUserRepository.findOne({
      where: { userId },
      relations: ['user'],
    });

    if (!mikrotikUser) {
      return { success: false, message: `MikroTik user mapping not found for user ID ${userId}` };
    }

    if (mikrotikUser.isEnabled) {
      return { success: true, message: `User ${userId} is already unblocked.` };
    }

    try {
      const api = await this.createApiClient();

      const enableResponse = await api.patch(`/ip/hotspot/user/${mikrotikUser.mikrotikUsername}`, {
        disabled: false,
      });

      if (enableResponse.status !== 200) {
        throw new Error(`Failed to enable user ${mikrotikUser.mikrotikUsername}`);
      }

      // 2. Update local database
      mikrotikUser.isEnabled = true;
      await this.mikrotikUserRepository.save(mikrotikUser);

      this.logger.log(`Unblocked MikroTik user ${mikrotikUser.mikrotikUsername} (App User ID: ${userId})`);
      return { success: true, message: `User ${userId} unblocked successfully.` };
    } catch (error) {
      this.logger.error(`Failed to unblock user ${userId}`, error.stack);
      return { success: false, message: `Failed to unblock user: ${error.message}` };
    }
  }

  async getUserStatusByUserId(userId: string): Promise<{ success: boolean; data?: any; message?: string }> {
    const mikrotikUser = await this.mikrotikUserRepository.findOne({
      where: { userId },
      relations: ['user'],
    });

    if (!mikrotikUser) {
      return { success: false, message: `MikroTik user mapping not found for user ID ${userId}` };
    }

    try {
      const api = await this.createApiClient();

      // 1. Get Hotspot User details
      const userResponse = await api.get(`/ip/hotspot/user/${mikrotikUser.mikrotikUsername}`);
      const userDetails = userResponse.data;

      // 2. Check if user is active (in /ip/hotspot/active)
      const activeResponse = await api.get(`/ip/hotspot/active`, {
        params: { '?user': mikrotikUser.mikrotikUsername },
      });
      const isActive = activeResponse.data.length > 0;
      const activeSession = activeResponse.data[0]; // Get first active session if any

      return {
        success: true,
        data: {
          mikrotikUsername: mikrotikUser.mikrotikUsername,
          ipAddress: mikrotikUser.ipAddress,
          isEnabled: mikrotikUser.isEnabled,
          mikrotikDetails: userDetails,
          isActive,
          activeSession: isActive ? activeSession : null,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get status for user ${userId}`, error.stack);
      return { success: false, message: `Failed to get user status: ${error.message}` };
    }
  }

  async getAllUsersWithStatus(): Promise<{ success: boolean; data?: any[]; message?: string }> {
    try {
      const api = await this.createApiClient();

      // 1. Get all MikroTik users
      const usersResponse = await api.get('/ip/hotspot/user');
      const mikrotikUsers = usersResponse.data;

      // 2. Get all active sessions
      const activeResponse = await api.get('/ip/hotspot/active');
      const activeSessions = activeResponse.data;

      // 3. Combine data
      const result = mikrotikUsers.map(user => {
        const isActive = activeSessions.some(session => session.user === user.name);
        const activeSession = activeSessions.find(session => session.user === user.name);
        return {
          ...user,
          isActive,
          activeSession: isActive ? activeSession : null,
        };
      });

      return { success: true, data: result };
    } catch (error) {
      this.logger.error('Failed to get all users status', error.stack);
      return { success: false, message: `Failed to get users status: ${error.message}` };
    }
  }

  
  async addUserMapping(userId: string, mikrotikUsername: string, ipAddress: string): Promise<{ success: boolean; message: string }> {
    // 1. Check if user exists in main User table (optional)
    const userExists = await this.userRepository.findOneBy({ id: userId });
    if (!userExists) {
      return { success: false, message: `User with ID ${userId} not found.` };
    }

    // 2. Check if mapping already exists
    const existingMapping = await this.mikrotikUserRepository.findOne({
      where: [{ userId }, { mikrotikUsername }, { ipAddress }],
    });
    if (existingMapping) {
      return { success: false, message: 'User ID, MikroTik username, or IP address already mapped.' };
    }

    // 3. Create mapping
    const newMapping = this.mikrotikUserRepository.create({
      userId,
      mikrotikUsername,
      ipAddress,
      isEnabled: true, // Default to enabled
    });

    try {
      await this.mikrotikUserRepository.save(newMapping);
      this.logger.log(`Added MikroTik user mapping for User ID: ${userId}`);
      return { success: true, message: 'User mapping added successfully.' };
    } catch (error) {
      this.logger.error('Failed to add user mapping', error.stack);
      return { success: false, message: `Failed to add user mapping: ${error.message}` };
    }
  }


  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleExpiredSubscriptions() {
    this.logger.log('🔍 [CRON] Starting automatic user blocking check...');

    try {
      const usersToBlock = await this.userRepository.find({
        where: {
          status: UserStatus.AKTIF,
          subscription: {due_date: LessThanOrEqual(new Date()) },
        },
        relations: ['mikrotikUser'],
      });

      if (usersToBlock.length === 0) {
        this.logger.log('📭 [CRON] No users found to block based on current criteria.');
        return;
      }

      this.logger.log(`📦 [CRON] Found ${usersToBlock.length} user(s) to block.`);

      for (const user of usersToBlock) {
        if (!user.mikrotikUser || !user.mikrotikUser.isEnabled) {
            this.logger.debug(`⏭️ [CRON] Skipping user ${user.id} - No active MikroTik mapping or already blocked.`);
            continue;
        }

        try {
            this.logger.log(`🔒 [CRON] Blocking user ${user.id} (${user.mikrotikUser.mikrotikUsername})...`);
            const blockResult = await this.blockUserByUserId(user.id); // Use existing logic

            if (blockResult.success) {
                this.logger.log(`✅ [CRON] Successfully blocked user ${user.id}.`);
                await this.userRepository.update(user.id, { status: UserStatus.NONAKTIF });
            } else {
                this.logger.warn(`⚠️ [CRON] Failed to block user ${user.id}: ${blockResult.message}`);
            }
        } catch (blockError) {
            this.logger.error(`💥 [CRON] Error blocking user ${user.id}`, blockError.stack);
        }
      }

      this.logger.log('🏁 [CRON] Automatic user blocking check completed.');

    } catch (error) {
      this.logger.error('💀 [CRON] Fatal error during automatic user blocking', error.stack);
    }
  }
}

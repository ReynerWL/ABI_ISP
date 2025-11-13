// src/mikrotik/mikrotik.service.ts
import { Injectable, Logger, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import axios, { AxiosInstance, AxiosBasicCredentials } from 'axios';
import { MikroTikUser } from './entities/mikrotik-user.entity';
import { MikroTikConnection } from './entities/mikrotik-connection.entity';
import { User, UserStatus } from '#/user/entities/user.entity'; // Adjust path
import { Cron, CronExpression } from '@nestjs/schedule';

export interface MikrotikQueue {
  id: string;
  name: string;
  target: string; // IP or IP range
  maxLimit: string; // e.g., "1M/1M"
  burstLimit: string;
  burstThreshold: string;
  burstTime: string;
  priority: number;
  queueType: string;
  parent: string;
  packetMarks: string;
  excludedAddresses: string;
  interface: string;
  disabled: boolean;
  dynamic: boolean;
  limitAt: string;
  rate: { up: string; down: string }; // Parsed from maxLimit
}

@Injectable()
export class MikrotikService {
  private readonly logger = new Logger(MikrotikService.name);

  constructor(
    @InjectRepository(MikroTikUser)
    private readonly mikrotikUserRepository: Repository<MikroTikUser>,
    @InjectRepository(MikroTikConnection)
    private readonly mikrotikConnectionRepository: Repository<MikroTikConnection>,
    @InjectRepository(User)
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
      timeout: 10000,
    });

    // Add interceptors for debugging (optional)
    api.interceptors.request.use(request => {
      this.logger.debug('MikroTik API Request:', request.method?.toUpperCase(), request.url);
      return request;
    });

    api.interceptors.response.use(
      response => {
        this.logger.debug('MikroTik API Response:', response.status, response.config.url);
        return response;
      },
      error => {
        this.logger.error('MikroTik API Error:', error.message);
        return Promise.reject(error);
      }
    );

    return api;
  }

  /**
   * ✅ Test MikroTik connection
   */
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

      // Determine protocol based on common ports
      let protocol: string;
      if (connection.port === 443 || connection.port === 8729) {
        protocol = 'https';
      } else if (connection.port === 80 || connection.port === 8728) {
        protocol = 'http';
      } else {
        protocol = connection.port === 443 ? 'https' : 'http';
        this.logger.warn(`Uncommon port ${connection.port} detected. Assuming protocol: ${protocol}. Verify MikroTik service configuration.`);
      }

      const baseURL = `${protocol}://${connection.host}:${connection.port}/rest`;
      const auth: AxiosBasicCredentials = {
        username: connection.username,
        password: connection.password,
      };

      this.logger.debug(`Attempting to connect to MikroTik at ${baseURL} with user ${auth.username}`);

      const response = await axios.get(`${baseURL}/system/resource`, {
        auth,
        timeout: 15000,
        httpsAgent: new (require('https')).Agent({ rejectUnauthorized: false }), // Only for testing!
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
      let errorMessage = 'Unknown error';
      if (error.code) {
        errorMessage = `Network/System Error Code: ${error.code}`;
      } else if (error.response) {
        errorMessage = `HTTP Error ${error.response.status}: ${error.response.statusText}`;
        if (error.response.data) {
          errorMessage += ` - Details: ${JSON.stringify(error.response.data).substring(0, 200)}...`;
        }
      } else if (error.request) {
        errorMessage = `No response received. Details: ${error.message}`;
      } else {
        errorMessage = `Request setup error: ${error.message}`;
      }

      this.logger.error(`❌ MikroTik connection test failed for ${connection?.host || 'unknown host'}:${connection?.port || 'unknown port'}`, errorMessage);
      return { success: false, message: `Connection failed: ${errorMessage}` };
    }
  }

  /**
   * ✅ Get all Simple Queues from MikroTik
   */
  async getQueueList(): Promise<{ success: boolean; data?: MikrotikQueue[]; message?: string }> {
    try {
      const api = await this.createApiClient();

      const response = await api.get('/queue/simple'); // MikroTik REST API path for simple queues

      if (response.status === 200) {
        const queues = response.data.map((queue: any) => ({
          id: queue['.id'],
          name: queue.name,
          target: queue.target,
          maxLimit: queue['max-limit'],
          burstLimit: queue['burst-limit'],
          burstThreshold: queue['burst-threshold'],
          burstTime: queue['burst-time'],
          priority: queue.priority,
          queueType: queue['queue-type'],
          parent: queue.parent,
          packetMarks: queue['packet-marks'],
          excludedAddresses: queue['excluded-addresses'],
          interface: queue.interface,
          disabled: queue.disabled === 'true',
          dynamic: queue.dynamic === 'true',
          limitAt: queue['limit-at'],
          // Parse rate from maxLimit (e.g., "1M/1M" -> { up: "1M", down: "1M" })
          rate: this.parseRate(queue['max-limit']),
        }));

        this.logger.log(`📋 Retrieved ${queues.length} queue entries from MikroTik`);
        return { success: true, data: queues };
      } else {
        return { success: false, message: `Unexpected response: ${response.status}` };
      }
    } catch (error) {
      this.logger.error('Failed to fetch queue list', error.stack);
      return { success: false, message: `Failed to fetch queue list: ${error.message}` };
    }
  }

  /**
   * ✅ Enable a queue entry by ID
   */
  async enableQueueById(queueId: string): Promise<{ success: boolean; message: string }> {
    try {
      const api = await this.createApiClient();

      const response = await api.patch(`/queue/simple/${queueId}`, {
        disabled: false,
      });

      if (response.status === 200) {
        this.logger.log(`✅ Enabled queue ID: ${queueId}`);
        return { success: true, message: `Queue ${queueId} enabled successfully` };
      } else {
        return { success: false, message: `Failed to enable queue ${queueId}` };
      }
    } catch (error) {
      this.logger.error(`Failed to enable queue ${queueId}`, error.stack);
      return { success: false, message: `Failed to enable queue: ${error.message}` };
    }
  }

  /**
   * ✅ Disable a queue entry by ID
   */
  async disableQueueById(queueId: string): Promise<{ success: boolean; message: string }> {
    try {
      const api = await this.createApiClient();

      const response = await api.patch(`/queue/simple/${queueId}`, {
        disabled: true,
      });

      if (response.status === 200) {
        this.logger.log(`🔴 Disabled queue ID: ${queueId}`);
        return { success: true, message: `Queue ${queueId} disabled successfully` };
      } else {
        return { success: false, message: `Failed to disable queue ${queueId}` };
      }
    } catch (error) {
      this.logger.error(`Failed to disable queue ${queueId}`, error.stack);
      return { success: false, message: `Failed to disable queue: ${error.message}` };
    }
  }

  /**
   * ✅ Get list of users from your database with their IPs from MikroTik mapping
   */
  async getUsersWithIps(): Promise<{ success: boolean; data?: any[]; message?: string }> {
    try {
      // Join User with MikroTikUser to get IP mapping
      const users = await this.userRepository
        .createQueryBuilder('user')
        .leftJoinAndSelect('user.mikrotikUser', 'mikrotikUser') // Assuming you have this relation
        .select([
          'user.id',
          'user.name',
          'user.customerId',
          'user.status',
          'user.phoneNumber',
          'mikrotikUser.ipAddress',
          'mikrotikUser.isEnabled as isMikrotikEnabled',
        ])
        .getMany();

      const result = users.map(user => ({
        id: user.id,
        name: user.name,
        customerId: user.customerId,
        status: user.status,
        phone: user.phone_number,
        ipAddress: user.mikrotikUser?.ipAddress || 'Not Assigned',
        isMikrotikEnabled: user.mikrotikUser?.isEnabled ?? false,
        mikrotikUsername: user.mikrotikUser?.mikrotikUsername || 'Not Set',
      }));

      this.logger.log(`👥 Retrieved ${result.length} users with IP mappings`);
      return { success: true, data: result };
    } catch (error) {
      this.logger.error('Failed to fetch users with IPs', error.stack);
      return { success: false, message: `Failed to fetch users: ${error.message}` };
    }
  }

  /**
   * ✅ Block user by User ID (from your database)
   */
  async blockUserByUserId(userId: string): Promise<{ success: boolean; message: string }> {
    const mikrotikUser = await this.mikrotikUserRepository.findOne({
      where: { userId },
      relations: ['user'],
    });

    if (!mikrotikUser) {
      return { success: false, message: `MikroTik user mapping not found for user ID ${userId}` };
    }

    if (!mikrotikUser.isEnabled) {
      return { success: true, message: `User ${userId} is already blocked.` };
    }

    try {
      const api = await this.createApiClient();

      const response = await api.patch(`/ip/hotspot/user/${mikrotikUser.mikrotikUsername}`, {
        disabled: true,
      });

      if (response.status !== 200) {
        throw new Error(`Failed to disable user ${mikrotikUser.mikrotikUsername}`);
      }

      // Update local database
      mikrotikUser.isEnabled = false;
      await this.mikrotikUserRepository.save(mikrotikUser);

      this.logger.log(`🔒 Blocked MikroTik user ${mikrotikUser.mikrotikUsername} (App User ID: ${userId})`);
      return { success: true, message: `User ${userId} blocked successfully.` };
    } catch (error) {
      this.logger.error(`Failed to block user ${userId}`, error.stack);
      return { success: false, message: `Failed to block user: ${error.message}` };
    }
  }

  /**
   * ✅ Unblock user by User ID (from your database)
   */
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

      const response = await api.patch(`/ip/hotspot/user/${mikrotikUser.mikrotikUsername}`, {
        disabled: false,
      });

      if (response.status !== 200) {
        throw new Error(`Failed to enable user ${mikrotikUser.mikrotikUsername}`);
      }

      // Update local database
      mikrotikUser.isEnabled = true;
      await this.mikrotikUserRepository.save(mikrotikUser);

      this.logger.log(`🔓 Unblocked MikroTik user ${mikrotikUser.mikrotikUsername} (App User ID: ${userId})`);
      return { success: true, message: `User ${userId} unblocked successfully.` };
    } catch (error) {
      this.logger.error(`Failed to unblock user ${userId}`, error.stack);
      return { success: false, message: `Failed to unblock user: ${error.message}` };
    }
  }

  /**
   * ✅ Get user status by User ID
   */
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

      // Get Hotspot User details
      const userResponse = await api.get(`/ip/hotspot/user/${mikrotikUser.mikrotikUsername}`);
      const userDetails = userResponse.data;

      // Check if user is active
      const activeResponse = await api.get(`/ip/hotspot/active`, {
        params: { '?user': mikrotikUser.mikrotikUsername },
      });
      const isActive = activeResponse.data.length > 0;
      const activeSession = activeResponse.data[0];

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

  /**
   * ✅ Get all users with their status
   */
  async getAllUsersWithStatus(): Promise<{ success: boolean; data?: any[]; message?: string }> {
    try {
      const api = await this.createApiClient();

      // Get all MikroTik users
      const usersResponse = await api.get('/ip/hotspot/user');
      const mikrotikUsers = usersResponse.data;

      // Get all active sessions
      const activeResponse = await api.get('/ip/hotspot/active');
      const activeSessions = activeResponse.data;

      // Combine data
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

  /**
   * ✅ Add user mapping
   */
  async addUserMapping(userId: string, mikrotikUsername: string, ipAddress: string): Promise<{ success: boolean; message: string }> {
    const userExists = await this.userRepository.findOneBy({ id: userId });
    if (!userExists) {
      return { success: false, message: `User with ID ${userId} not found.` };
    }

    const existingMapping = await this.mikrotikUserRepository.findOne({
      where: [{ userId }, { mikrotikUsername }, { ipAddress }],
    });
    if (existingMapping) {
      return { success: false, message: 'User ID, MikroTik username, or IP address already mapped.' };
    }

    const newMapping = this.mikrotikUserRepository.create({
      userId,
      mikrotikUsername,
      ipAddress,
      isEnabled: true,
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

  /**
   * ✅ Parse rate from MikroTik format (e.g., "1M/1M" -> { up: "1M", down: "1M" })
   */
  private parseRate(rateString: string): { up: string; down: string } {
    if (!rateString || !rateString.includes('/')) {
      return { up: '0', down: '0' };
    }
    const [up, down] = rateString.split('/');
    return { up: up.trim(), down: down.trim() };
  }

  /**
   * ✅ Cron job: Handle expired subscriptions
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleExpiredSubscriptions() {
    this.logger.log('🔍 [CRON] Starting automatic user blocking check...');

    try {
      const usersToBlock = await this.userRepository.find({
        where: {
          status: UserStatus.AKTIF,
          subscription: { due_date: LessThanOrEqual(new Date()) },
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
          const blockResult = await this.blockUserByUserId(user.id);

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
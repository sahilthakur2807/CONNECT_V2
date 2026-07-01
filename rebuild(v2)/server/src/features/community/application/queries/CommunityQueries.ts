import { CommunityRepository } from '../../infrastructure/repository/CommunityRepository.js';
import { CommunityMembershipRepository } from '../../infrastructure/repository/CommunityMembershipRepository.js';
import { NotFoundError } from '../../../../shared/errors/AppError.js';

// --- Queries ---

export class GetCommunitiesQuery {
  constructor(public readonly userId?: string) {}
}

export class GetCommunityByIdQuery {
  constructor(public readonly communityId: string) {}
}

export class GetCommunityMembersQuery {
  constructor(
    public readonly communityId: string,
    public readonly page = 1,
    public readonly limit = 20
  ) {}
}

// --- Handlers ---

export class GetCommunitiesHandler {
  constructor(private readonly communityRepo: CommunityRepository) {}

  async execute(query: GetCommunitiesQuery): Promise<any[]> {
    return this.communityRepo.findVisible(query.userId);
  }
}

export class GetCommunityByIdHandler {
  constructor(private readonly communityRepo: CommunityRepository) {}

  async execute(query: GetCommunityByIdQuery): Promise<any> {
    const community = await this.communityRepo.findCommunityDetails(query.communityId);
    if (!community) {
      throw new NotFoundError('Community not found');
    }
    return community;
  }
}

export class GetCommunityMembersHandler {
  constructor(private readonly membershipRepo: CommunityMembershipRepository) {}

  async execute(query: GetCommunityMembersQuery): Promise<any[]> {
    return this.membershipRepo.findActiveMembers(query.communityId, query.page, query.limit);
  }
}

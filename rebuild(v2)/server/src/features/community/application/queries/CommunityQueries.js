import { NotFoundError } from "../../../../shared/errors/AppError.js";

// --- Queries ---

export class GetCommunitiesQuery {
  constructor(userId) {
    this.userId = userId;
  }
}

export class GetCommunityByIdQuery {
  constructor(communityId) {
    this.communityId = communityId;
  }
}

export class GetCommunityMembersQuery {
  constructor(communityId, page = 1, limit = 20) {
    this.communityId = communityId;
    this.page = page;
    this.limit = limit;
  }
}

// --- Handlers ---

export class GetCommunitiesHandler {
  constructor(communityRepo) {
    this.communityRepo = communityRepo;
  }

  async execute(query) {
    return this.communityRepo.findVisible(query.userId);
  }
}

export class GetCommunityByIdHandler {
  constructor(communityRepo) {
    this.communityRepo = communityRepo;
  }

  async execute(query) {
    const community = await this.communityRepo.findCommunityDetails(
      query.communityId,
    );
    if (!community) {
      throw new NotFoundError("Community not found");
    }
    return community;
  }
}

export class GetCommunityMembersHandler {
  constructor(membershipRepo) {
    this.membershipRepo = membershipRepo;
  }

  async execute(query) {
    return this.membershipRepo.findActiveMembers(
      query.communityId,
      query.page,
      query.limit,
    );
  }
}

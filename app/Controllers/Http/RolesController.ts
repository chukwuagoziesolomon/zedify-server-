// import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'

export default class RolesController {

  public allowOnlySuperAdmins(auth) {
    try {
      const user = auth.use('admin').user ?? '';
      if (!user)
        throw new Error('Authentication error!')

      if (user.type !== 'SUPER_ADMIN')
        throw new Error('Not authorized!')
    } catch (error) {
      throw new Error(error)
    }
  }
  public allowAllAdmins(auth) {
    try {
      const user = auth.use('admin').user ?? '';
      if (!user)
        throw new Error('Authentication error!')

      if (user.type !== 'SUPER_ADMIN' && user.type !== 'ADMIN')
        throw new Error('Not authorized!')
    } catch (error) {
      throw new Error(error)
    }
  }

  public allowOnlyLoggedInUsers(auth) {
    try {
      const uniqueId = auth.use('user').user?.uniqueId ?? '';
      if (!uniqueId)
        throw new Error('Authentication error!')

      return uniqueId;
    } catch (error) {
      throw new Error(error)
    }
  }

  public allowOnlyLoggedInUsersAndAdmin(auth) {
    try {
      // Try to get user from 'user' guard
      const userUniqueId = auth.use('user').user?.uniqueId;
      if (userUniqueId) {
        return { uniqueId: userUniqueId, role: 'user' };
      }

      // Try to get user from 'admin' guard
      const adminUser = auth.use('admin').user;
      if (adminUser && adminUser.uniqueId) {
        return { uniqueId: adminUser.uniqueId, role: adminUser.type?.toLowerCase() || 'admin' };
      }

      throw new Error('Authentication error!');
    } catch (error) {
      throw new Error(error);
    }
  }

}

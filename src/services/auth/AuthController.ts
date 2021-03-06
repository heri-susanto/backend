import { Request, Response } from 'express';
import { getRepository } from 'typeorm';
import { validate } from 'class-validator';

import { User } from '../../entity/User';

import * as jwt from 'jsonwebtoken';

import config from '../../config/config';

class AuthController {
  static register = async (req: Request, res: Response) => {
    // const data = JSON.parse(request.data);
    // const { displayName, password, email } = data;
    console.log(req.body.data);
    let { displayName, email, password, role } = req.body.data;
    const userRepository = getRepository(User);
    const isEmailExists = await userRepository.find({ email: email });

    if (isEmailExists.length > 0) {
      res.status(409).send('Email already exists.');
    }
    // const isEmailExists = authDB.users.find(
    //   _user => _user.data.email === email
    // );
    // const error = {
    //   email: isEmailExists ? 'The email is already in use' : null,
    //   displayName: displayName !== '' ? null : 'Enter display name',
    //   password: null
    // };
    else {
      try {
        if (displayName && password && email && role) {
          let user = new User();
          user.email = email;
          user.displayName = displayName;
          user.password = password;
          user.role = role;
          user.photoURL = 'assets/images/avatars/Abbott.jpg';
          user.hashPassword();
          const userRepository = getRepository(User);
          const newUser = await userRepository.save(user);
          delete newUser['password'];

          const access_token = jwt.sign(
            { userId: user.id, email: user.email },
            config.jwtSecret,
            { expiresIn: config.expiresIn }
          );

          const user_data = {
            uuid: newUser.id,
            from: 'express-postgres-db',
            role: newUser.role,
            data: {
              displayName: newUser.displayName,
              photoURL: newUser.photoURL,
              email: newUser.email,
              about: newUser.about,
              address: newUser.address,
              isVerified: newUser.isVerified,
              createdAt: newUser.createdAt,
              updatedAt: newUser.updatedAt
            }
          };

          const response = {
            user: user_data,
            access_token: access_token
          };
          res.send(response);
        } else {
          res.status(400).send('Data tidak boleh kosong');
        }
      } catch (e) {
        const error = 'Error when register';
        res.status(400).send(error);
      }
    }
  };

  static login = async (req: Request, res: Response) => {
    let { email, password } = req.body.data;

    if (!(email && password)) {
      res.status(400).send();
    }

    //Get user from database
    const userRepository = getRepository(User);
    let user!: User;
    try {
      user = await userRepository.findOneOrFail({ where: { email } });
    } catch (error) {
      res.status(401).send();
    }

    // //Check if encrypted password match
    console.log(user);
    if (!user.checkIfUnencryptedPasswordIsValid(password)) {
      res.status(401).send();
      return;
    }

    const user_data = {
      uuid: user.id,
      from: 'express-postgres-db',
      role: user.role,
      data: {
        displayName: user.displayName,
        photoURL: user.photoURL,
        email: user.email,
        about: user.about,
        address: user.address,
        isVerified: user.isVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    };

    const access_token = jwt.sign(
      { userId: user.id, email: user.email },
      config.jwtSecret,
      { expiresIn: config.expiresIn }
    );
    const response = {
      user: user_data,
      access_token: access_token
    };
    console.log(response);

    res.send(response);
  };

  static loginWithToken = async (req: Request, res: Response) => {
    let { access_token } = req.body.data;
    if (access_token.startsWith('Bearer ')) {
      // Remove Bearer from string
      access_token = access_token.slice(7, access_token.length);
    }

    try {
      const { email }: any = jwt.verify(access_token, config.jwtSecret);
      const userRepository = getRepository(User);
      let user!: User;
      try {
        user = await userRepository.findOneOrFail({ where: { email } });
      } catch (error) {
        res.status(401).send();
      }
      // const user = _.cloneDeep(authDB.users.find(_user => _user.uuid === id));
      delete user['password'];

      const new_access_token = jwt.sign(
        { userId: user.id, email: user.email },
        config.jwtSecret,
        { expiresIn: config.expiresIn }
      );
      const user_data = {
        uuid: user.id,
        from: 'express-postgres-db',
        role: user.role,
        data: {
          displayName: user.displayName,
          photoURL: user.photoURL,
          email: user.email,
          about: user.about,
          address: user.address,
          isVerified: user.isVerified,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        }
      };

      const response = {
        user: user_data,
        access_token: new_access_token
      };
      res.send(response);
      // return [200, response];
    } catch (e) {
      const error = 'Invalid access token detected';
      // return [401, { error }];
      res.status(401).send(error);
    }
  };

  static changePassword = async (req: Request, res: Response) => {
    //Get ID from JWT
    const id = res.locals.jwtPayload.userId;

    //Get parameters from the body
    const { oldPassword, newPassword } = req.body;
    if (!(oldPassword && newPassword)) {
      res.status(400).send('Password harus diisi bos');
    }

    //Get user from the database
    const userRepository = getRepository(User);
    let user!: User;
    try {
      user = await userRepository.findOneOrFail(id);
    } catch (id) {
      res.status(401).send();
    }

    //Check if old password matchs
    if (!user.checkIfUnencryptedPasswordIsValid(oldPassword)) {
      res.status(401).send();
      return;
    }

    //Validate de model (password lenght)
    user.password = newPassword;
    const errors = await validate(user);
    if (errors.length > 0) {
      res.status(400).send(errors);
      return;
    }
    //Hash the new password and save
    user.hashPassword();
    userRepository.save(user);

    res.status(204).send('Data berhasil diupdate');
  };
}
export default AuthController;
